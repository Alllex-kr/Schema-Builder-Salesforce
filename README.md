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
- Filter the object list to standard objects, custom objects, or both.
- Add readable objects to a draggable schema canvas.
- Automatically arrange cards or clear the current canvas view.
- Show readable fields with API name, data type, required marker, and relationship target.
- Draw a connector when both ends of a readable relationship are on the canvas.
- Inspect field details in a side panel and remove cards from the current view.
- No metadata create, edit, or delete operations.

## Security model

`SchemaBrowserController` is `with sharing`. It filters objects with `DescribeSObjectResult.isAccessible()` and fields with `DescribeFieldResult.isAccessible()`, and rechecks the requested object in the detail method. Relationship targets are returned only when readable to the current user. The controller exposes no metadata write API. The UI is not a security boundary; visibility is filtered in Apex for the current user.

## Important validation

Validate in a sandbox using a standard user without `Customize Application`. Confirm which standard, custom, and managed objects are returned by describe in the target org. Object fields load only when a card is added, avoiding an all-schema response.
