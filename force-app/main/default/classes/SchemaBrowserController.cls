public with sharing class SchemaBrowserController {
    public class ObjectInfo {
        @AuraEnabled public String apiName { get; set; }
        @AuraEnabled public String label { get; set; }
        @AuraEnabled public String pluralLabel { get; set; }
        @AuraEnabled public String keyPrefix { get; set; }
        @AuraEnabled public Boolean custom { get; set; }
    }

    public class FieldInfo {
        @AuraEnabled public String apiName { get; set; }
        @AuraEnabled public String label { get; set; }
        @AuraEnabled public String dataType { get; set; }
        @AuraEnabled public Boolean required { get; set; }
        @AuraEnabled public Boolean calculated { get; set; }
        @AuraEnabled public String relationshipName { get; set; }
        @AuraEnabled public List<String> referenceTo { get; set; }
    }

    @AuraEnabled(cacheable=true)
    public static List<ObjectInfo> getAccessibleObjects() {
        List<ObjectInfo> results = new List<ObjectInfo>();
        Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();

        for (String apiName : globalDescribe.keySet()) {
            Schema.DescribeSObjectResult objectDescribe = globalDescribe.get(apiName).getDescribe();
            if (!objectDescribe.isAccessible() || !objectDescribe.isQueryable()) {
                continue;
            }

            ObjectInfo item = new ObjectInfo();
            item.apiName = apiName;
            item.label = objectDescribe.getLabel();
            item.pluralLabel = objectDescribe.getLabelPlural();
            item.keyPrefix = objectDescribe.getKeyPrefix();
            item.custom = objectDescribe.isCustom();
            results.add(item);
        }

        results.sort(new ObjectInfoComparator());
        return results;
    }

    @AuraEnabled(cacheable=true)
    public static List<FieldInfo> getReadableFields(String objectApiName) {
        if (String.isBlank(objectApiName)) {
            throw new AuraHandledException('An object API name is required.');
        }

        Schema.SObjectType objectType = Schema.getGlobalDescribe().get(objectApiName);
        if (objectType == null) {
            throw new AuraHandledException('The requested object is unavailable.');
        }

        Schema.DescribeSObjectResult objectDescribe = objectType.getDescribe();
        if (!objectDescribe.isAccessible() || !objectDescribe.isQueryable()) {
            throw new AuraHandledException('You do not have read access to this object.');
        }

        List<FieldInfo> results = new List<FieldInfo>();
        Map<String, Schema.SObjectField> fields = objectDescribe.fields.getMap();
        for (String fieldApiName : fields.keySet()) {
            Schema.DescribeFieldResult fieldDescribe = fields.get(fieldApiName).getDescribe();
            if (!fieldDescribe.isAccessible()) {
                continue;
            }

            FieldInfo item = new FieldInfo();
            item.apiName = fieldApiName;
            item.label = fieldDescribe.getLabel();
            item.dataType = String.valueOf(fieldDescribe.getType());
            item.required = !fieldDescribe.isNillable() && !fieldDescribe.isDefaultedOnCreate();
            item.calculated = fieldDescribe.isCalculated();
            item.relationshipName = fieldDescribe.getRelationshipName();
            item.referenceTo = new List<String>();

            if (fieldDescribe.getType() == Schema.DisplayType.REFERENCE) {
                for (Schema.SObjectType targetType : fieldDescribe.getReferenceTo()) {
                    Schema.DescribeSObjectResult targetDescribe = targetType.getDescribe();
                    if (targetDescribe.isAccessible() && targetDescribe.isQueryable()) {
                        item.referenceTo.add(targetDescribe.getName());
                    }
                }
            }
            results.add(item);
        }

        results.sort(new FieldInfoComparator());
        return results;
    }

    public class ObjectInfoComparator implements Comparator<ObjectInfo> {
        public Integer compare(ObjectInfo left, ObjectInfo right) {
            return left.label.toLowerCase().compareTo(right.label.toLowerCase());
        }
    }

    public class FieldInfoComparator implements Comparator<FieldInfo> {
        public Integer compare(FieldInfo left, FieldInfo right) {
            return left.label.toLowerCase().compareTo(right.label.toLowerCase());
        }
    }
}
