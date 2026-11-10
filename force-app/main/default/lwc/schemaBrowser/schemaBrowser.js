import { LightningElement } from 'lwc';
import getAccessibleObjects from '@salesforce/apex/SchemaBrowserController.getAccessibleObjects';
import getReadableFields from '@salesforce/apex/SchemaBrowserController.getReadableFields';

const CARD_WIDTH = 340;
const COLUMN_GAP = 50;
const ROW_GAP = 550;
const CANVAS_PADDING = 30;
const DEFAULT_CANVAS_WIDTH = 1180;
const DEFAULT_CANVAS_HEIGHT = 640;

export default class SchemaBrowser extends LightningElement {
    objects = [];
    canvasObjects = [];
    relationshipLines = [];
    selectedField;
    searchTerm = '';
    isLoadingObjects = true;
    errorMessage;
    dragState;

    constructor() {
        super();
        this.handlePointerMove = this.handlePointerMove.bind(this);
        this.handlePointerUp = this.handlePointerUp.bind(this);
    }

    connectedCallback() {
        window.addEventListener('pointermove', this.handlePointerMove);
        window.addEventListener('pointerup', this.handlePointerUp);
        window.addEventListener('pointercancel', this.handlePointerUp);
        this.loadObjects();
    }

    disconnectedCallback() {
        window.removeEventListener('pointermove', this.handlePointerMove);
        window.removeEventListener('pointerup', this.handlePointerUp);
        window.removeEventListener('pointercancel', this.handlePointerUp);
    }

    renderedCallback() {
        this.updateRelationshipLines();
    }

    get filteredObjects() {
        const term = (this.searchTerm || '').trim().toLowerCase();
        return this.objects
            .filter((item) => !term || item.label.toLowerCase().includes(term) || item.apiName.toLowerCase().includes(term))
            .map((item) => {
                const canvasItem = this.canvasObjects.find((entry) => entry.apiName === item.apiName);
                return {
                    ...item,
                    isLoading: Boolean(canvasItem?.isLoading),
                    addIcon: canvasItem ? 'utility:check' : 'utility:add',
                    addLabel: canvasItem ? 'Remove from canvas' : 'Add to canvas'
                };
            });
    }

    get hasFilteredObjects() {
        return this.filteredObjects.length > 0;
    }

    get hasCanvasObjects() {
        return this.canvasObjects.length > 0;
    }

    get canvasObjectCount() {
        return this.canvasObjects.length;
    }

    get canvasStyle() {
        const maxX = this.canvasObjects.reduce((value, item) => Math.max(value, item.x + CARD_WIDTH), 0);
        const maxY = this.canvasObjects.reduce((value, item) => Math.max(value, item.y + 520), 0);
        return `width:${Math.max(DEFAULT_CANVAS_WIDTH, maxX + CANVAS_PADDING)}px;height:${Math.max(DEFAULT_CANVAS_HEIGHT, maxY + CANVAS_PADDING)}px;`;
    }

    async loadObjects() {
        this.isLoadingObjects = true;
        this.errorMessage = undefined;
        try {
            this.objects = await getAccessibleObjects();
        } catch (error) {
            this.errorMessage = this.getErrorMessage(error);
        } finally {
            this.isLoadingObjects = false;
        }
    }

    handleSearch(event) {
        this.searchTerm = event.target.value;
    }

    async handleToggleObject(event) {
        const objectApiName = event.currentTarget.dataset.name;
        const existing = this.canvasObjects.find((item) => item.apiName === objectApiName);
        if (existing) {
            this.removeObject(objectApiName);
            return;
        }

        const objectInfo = this.objects.find((item) => item.apiName === objectApiName);
        if (!objectInfo) {
            return;
        }

        let column = 0;
        let row = 0;
        let slotAvailable = false;
        while (!slotAvailable) {
            const candidateX = CANVAS_PADDING + column * (CARD_WIDTH + COLUMN_GAP);
            const candidateY = CANVAS_PADDING + row * ROW_GAP;
            slotAvailable = this.canvasObjects.every((item) =>
                item.x + CARD_WIDTH + COLUMN_GAP <= candidateX ||
                candidateX + CARD_WIDTH + COLUMN_GAP <= item.x ||
                item.y + 520 + 30 <= candidateY ||
                candidateY + 520 + 30 <= item.y
            );
            if (!slotAvailable) {
                column += 1;
                if (column === 3) {
                    column = 0;
                    row += 1;
                }
            }
        }
        const newObject = {
            ...objectInfo,
            fields: [],
            isLoading: true,
            x: CANVAS_PADDING + column * (CARD_WIDTH + COLUMN_GAP),
            y: CANVAS_PADDING + row * ROW_GAP,
            cardStyle: this.getCardStyle(
                CANVAS_PADDING + column * (CARD_WIDTH + COLUMN_GAP),
                CANVAS_PADDING + row * ROW_GAP
            )
        };
        this.canvasObjects = [...this.canvasObjects, newObject];

        try {
            const fields = await getReadableFields({ objectApiName });
            this.updateCanvasObject(objectApiName, {
                fields: fields.map((field) => ({
                    ...field,
                    relationshipSummary: (field.referenceTo || []).join(', '),
                    rowClass: 'field-row'
                })),
                isLoading: false
            });
        } catch (error) {
            this.removeObject(objectApiName);
            this.errorMessage = this.getErrorMessage(error);
        }
    }

    handleRemoveObject(event) {
        this.removeObject(event.currentTarget.dataset.name);
    }

    removeObject(objectApiName) {
        this.canvasObjects = this.canvasObjects.filter((item) => item.apiName !== objectApiName);
        if (this.selectedField?.objectApiName === objectApiName) {
            this.selectedField = undefined;
        }
        this.errorMessage = undefined;
    }

    updateCanvasObject(objectApiName, changes) {
        this.canvasObjects = this.canvasObjects.map((item) =>
            item.apiName === objectApiName
                ? {
                    ...item,
                    ...changes,
                    cardStyle: this.getCardStyle(changes.x ?? item.x, changes.y ?? item.y)
                }
                : item
        );
    }

    getCardStyle(x, y) {
        return `left:${x}px;top:${y}px;`;
    }

    handleSelectField(event) {
        const objectApiName = event.currentTarget.dataset.object;
        const fieldApiName = event.currentTarget.dataset.field;
        const objectInfo = this.canvasObjects.find((item) => item.apiName === objectApiName);
        const field = objectInfo?.fields.find((item) => item.apiName === fieldApiName);
        if (!field) {
            return;
        }

        this.selectedField = {
            ...field,
            objectApiName,
            objectLabel: objectInfo.label,
            requiredLabel: field.required ? 'Yes' : 'No',
            calculatedLabel: field.calculated ? 'Yes' : 'No',
            referenceSummary: (field.referenceTo || []).join(', ')
        };
        this.canvasObjects = this.canvasObjects.map((item) => ({
            ...item,
            fields: item.fields.map((currentField) => ({
                ...currentField,
                rowClass: item.apiName === objectApiName && currentField.apiName === fieldApiName
                    ? 'field-row selected'
                    : 'field-row'
            }))
        }));
    }

    handleDragStart(event) {
        const objectApiName = event.currentTarget.dataset.name;
        const item = this.canvasObjects.find((entry) => entry.apiName === objectApiName);
        if (!item) {
            return;
        }

        event.preventDefault();
        this.dragState = {
            objectApiName,
            startX: event.clientX,
            startY: event.clientY,
            originX: item.x,
            originY: item.y
        };
    }

    handlePointerMove(event) {
        if (!this.dragState) {
            return;
        }

        const deltaX = event.clientX - this.dragState.startX;
        const deltaY = event.clientY - this.dragState.startY;
        this.updateCanvasObject(this.dragState.objectApiName, {
            x: Math.max(0, this.dragState.originX + deltaX),
            y: Math.max(0, this.dragState.originY + deltaY)
        });
    }

    handlePointerUp() {
        this.dragState = undefined;
    }

    updateRelationshipLines() {
        const canvas = this.template.querySelector('.canvas-content');
        if (!canvas || this.canvasObjects.length < 2) {
            if (this.relationshipLines.length) {
                this.relationshipLines = [];
            }
            return;
        }

        const canvasRect = canvas.getBoundingClientRect();
        const cards = new Map();
        this.template.querySelectorAll('article[data-object]').forEach((card) => {
            cards.set(card.dataset.object, card.getBoundingClientRect());
        });

        const lines = [];
        this.canvasObjects.forEach((source) => {
            const sourceRect = cards.get(source.apiName);
            if (!sourceRect || source.isLoading) {
                return;
            }

            source.fields.forEach((field) => {
                (field.referenceTo || []).forEach((targetApiName) => {
                    const targetRect = cards.get(targetApiName);
                    if (!targetRect || targetApiName === source.apiName) {
                        return;
                    }

                    const leftToRight = targetRect.left >= sourceRect.left;
                    const x1 = (leftToRight ? sourceRect.right : sourceRect.left) - canvasRect.left;
                    const y1 = (sourceRect.top + sourceRect.height / 2) - canvasRect.top;
                    const x2 = (leftToRight ? targetRect.left : targetRect.right) - canvasRect.left;
                    const y2 = (targetRect.top + targetRect.height / 2) - canvasRect.top;
                    const direction = x2 >= x1 ? 1 : -1;
                    const curve = Math.max(48, Math.abs(x2 - x1) * 0.42);
                    lines.push({
                        key: `${source.apiName}-${field.apiName}-${targetApiName}`,
                        path: `M ${x1} ${y1} C ${x1 + curve * direction} ${y1}, ${x2 - curve * direction} ${y2}, ${x2} ${y2}`
                    });
                });
            });
        });

        const signature = lines.map((line) => `${line.key}:${line.path}`).join('|');
        const currentSignature = this.relationshipLines.map((line) => `${line.key}:${line.path}`).join('|');
        if (signature !== currentSignature) {
            this.relationshipLines = lines;
        }
    }

    getErrorMessage(error) {
        return error?.body?.message || error?.message || 'The schema could not be loaded.';
    }
}
