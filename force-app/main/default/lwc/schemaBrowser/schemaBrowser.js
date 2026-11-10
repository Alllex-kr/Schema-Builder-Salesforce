import { LightningElement } from 'lwc';
import getAccessibleObjects from '@salesforce/apex/SchemaBrowserController.getAccessibleObjects';
import getReadableFields from '@salesforce/apex/SchemaBrowserController.getReadableFields';

const COLUMNS = [
    { label: 'Field', fieldName: 'label', type: 'text' },
    { label: 'API Name', fieldName: 'apiName', type: 'text' },
    { label: 'Type', fieldName: 'dataType', type: 'text' },
    { label: 'Required', fieldName: 'required', type: 'boolean' },
    { label: 'Relationship', fieldName: 'relationshipSummary', type: 'text', wrapText: true }
];

export default class SchemaBrowser extends LightningElement {
    objects = [];
    fields = [];
    selectedObject;
    searchTerm = '';
    isLoadingObjects = true;
    isLoadingFields = false;
    errorMessage;
    columns = COLUMNS;

    connectedCallback() {
        this.loadObjects();
    }

    get filteredObjects() {
        const term = (this.searchTerm || '').trim().toLowerCase();
        return this.objects
            .filter((item) => !term || item.label.toLowerCase().includes(term) || item.apiName.toLowerCase().includes(term))
            .map((item) => ({
                ...item,
                buttonClass: item.apiName === this.selectedObject?.apiName ? 'object-item selected' : 'object-item'
            }));
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

    async handleSelectObject(event) {
        const objectApiName = event.currentTarget.dataset.name;
        this.selectedObject = this.objects.find((item) => item.apiName === objectApiName);
        this.fields = [];
        this.errorMessage = undefined;
        this.isLoadingFields = true;
        try {
            const result = await getReadableFields({ objectApiName });
            this.fields = result.map((field) => ({
                ...field,
                relationshipSummary: field.referenceTo?.join(', ') || ''
            }));
        } catch (error) {
            this.errorMessage = this.getErrorMessage(error);
        } finally {
            this.isLoadingFields = false;
        }
    }

    getErrorMessage(error) {
        return error?.body?.message || error?.message || 'The schema could not be loaded.';
    }
}
