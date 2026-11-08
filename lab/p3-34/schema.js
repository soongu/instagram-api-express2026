// ~/instagram-api/lab/p3-34/schema.js
import { z } from 'zod';
import { postListQuerySchema } from '../../schemas/postSchema.js';

console.log(JSON.stringify(z.toJSONSchema(postListQuerySchema, { io: 'input' }), null, 2));
