# Read-only Salesforce Schema Browser

A Salesforce DX Lightning app for exploring the schema a user can read. The app permission set grants access to the app and its read-only Apex controller; the user's existing object and field permissions determine which objects and fields appear.

## Deploy

Requires Salesforce CLI and an authorized Salesforce org.

```sh
sf org login web --alias schema-dev
sf project deploy start --target-org schema-dev
```

Assign the `Schema_Browser_User` permission set to users who should open the app. It grants app and Apex class access only; it does not grant `Customize Application`, object permissions, field permissions, or setup permissions.

## Current scope

- Search accessible objects by label or API name.
- Select an object and inspect its readable fields.
- Show field type, requiredness, and readable relationship targets.
- No metadata create, edit, or delete operations.

## Security model

`SchemaBrowserController` is `with sharing`. It filters objects with `DescribeSObjectResult.isAccessible()` and fields with `DescribeFieldResult.isAccessible()`, and rechecks the requested object in the detail method. The controller exposes no metadata write API. The UI is not a security boundary; visibility is filtered in Apex for the current user.

## Important validation

Validate in a sandbox using a standard user without `Customize Application`. Confirm which standard, custom, and managed objects are returned by describe in the target org. Fields load only when an object is selected, avoiding a large all-schema response.