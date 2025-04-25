# Database Migration Guide

## Page-Canvas Relationship Migration (April 2025)

This migration changes the relationship between Pages and Canvases from using an intermediate table (`canvas_entity_relations`) to a direct relationship with a `canvas_id` field in the `pages` table.

### Migration Steps

1. Pull the latest code changes
2. Run the migration:

```bash
cd apps/api
npx prisma migrate deploy
```

If you're using a development environment, you can also use:

```bash
cd apps/api
npx prisma migrate dev --name add_canvas_id_to_pages
```

### What This Migration Does

1. Adds a `canvas_id` field to the `pages` table
2. Migrates existing relationships from `canvas_entity_relations` to the new field
3. Creates new canvases for any pages without an associated canvas
4. Makes the `canvas_id` field required (NOT NULL)
5. Adds an index for improved query performance

### Troubleshooting

If you encounter any issues during migration:

1. Check the Prisma migration logs
2. Ensure you have backup of your database before migrating
3. If needed, you can manually run the SQL migration script located at `prisma/migrations/20250416_add_canvas_id_to_pages/migration.sql`

For any questions or issues, please contact the development team.
