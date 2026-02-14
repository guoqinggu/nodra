/**
 * Nodra Framework - OpenAPI Generator
 *
 * Generates OpenAPI 3.0 schema from DocType definitions.
 */

import type { DocTypeDefinition, FieldDefinition } from '../core/doctype/schema.js';

export interface OpenAPISchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  format?: string;
  enum?: string[];
}

export interface OpenAPIParameter {
  name: string;
  in: string;
  required: boolean;
  schema: OpenAPISchema;
  description?: string;
}

/**
 * Convert a DocType field to OpenAPI schema
 */
export function convertFieldToSchema(field: FieldDefinition): OpenAPISchema {
  const schema: OpenAPISchema = { type: 'string' };

  switch (field.fieldtype) {
    case 'Data':
      schema.type = 'string';
      break;
    case 'Float':
    case 'Currency':
      schema.type = 'number';
      break;
    case 'Check':
      schema.type = 'boolean';
      break;
    case 'Date':
    case 'Datetime':
      schema.type = 'string';
      schema.format = field.fieldtype === 'Datetime' ? 'date-time' : 'date';
      break;
    case 'Text':
    case 'LongText':
    case 'SmallText':
      schema.type = 'string';
      break;
    case 'Select':
      schema.type = 'string';
      if (field.options) {
        const options = typeof field.options === 'string'
          ? field.options.split('\n').map((opt) => opt.trim())
          : field.options;
        schema.enum = options.filter((opt) => opt.length > 0);
      }
      break;
    case 'Link':
      schema.type = 'string';
      break;
    case 'Table':
      schema.type = 'array';
      break;
    default:
      schema.type = 'string';
  }

  return schema;
}

/**
 * Generate OpenAPI schema from DocType definition
 */
export function generateDocTypeSchema(doctype: DocTypeDefinition): OpenAPISchema {
  const properties: Record<string, OpenAPISchema> = {};
  const required: string[] = [];

  for (const field of doctype.fields ?? []) {
    properties[field.fieldname] = convertFieldToSchema(field);
    if (field.reqd) {
      required.push(field.fieldname);
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 && { required }),
  };
}

/**
 * Generate CRUD route definitions for a DocType
 */
export function generateCRUDRoutes(doctype: DocTypeDefinition): Record<string, unknown> {
  const basePath = `/api/resource/${doctype.name}`;

  return {
    [`${basePath}`]: {
      get: {
        summary: `List ${doctype.name}`,
        tags: [doctype.name],
        responses: {
          '200': {
            description: `List of ${doctype.name}`,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: `#/components/schemas/${doctype.name}` },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: `Create ${doctype.name}`,
        tags: [doctype.name],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${doctype.name}` },
            },
          },
        },
        responses: {
          '201': {
            description: `Created ${doctype.name}`,
          },
        },
      },
    },
    [`${basePath}/{name}`]: {
      get: {
        summary: `Get ${doctype.name} by name`,
        tags: [doctype.name],
        parameters: [
          {
            name: 'name',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: `${doctype.name} details`,
          },
        },
      },
      put: {
        summary: `Update ${doctype.name}`,
        tags: [doctype.name],
        parameters: [
          {
            name: 'name',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${doctype.name}` },
            },
          },
        },
        responses: {
          '200': {
            description: `Updated ${doctype.name}`,
          },
        },
      },
      delete: {
        summary: `Delete ${doctype.name}`,
        tags: [doctype.name],
        parameters: [
          {
            name: 'name',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '204': {
            description: `Deleted ${doctype.name}`,
          },
        },
      },
    },
  };
}
