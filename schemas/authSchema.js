// ~/instagram-api/schemas/authSchema.js
import { z } from 'zod';

// 아직 비밀번호가 없다 — 이름 하나만 받는다.
export const loginSchema = z.object({
  username: z.string().min(1),
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE = /^010-?\d{4}-?\d{4}$/;

// 비밀번호도 받아서 규칙을 검사하지만, 저장은 하지 않는다.
export const signupSchema = z.object({
  emailOrPhone: z
    .string()
    .trim()
    .refine((value) => EMAIL.test(value) || PHONE.test(value), {
      error: '이메일 주소나 휴대폰 번호를 적어 주세요',
    }),
  name: z.string().trim().min(1, { error: '성명을 적어 주세요' }),
  username: z
    .string()
    .min(1, { error: '사용자 이름을 적어 주세요' })
    .max(30, { error: '사용자 이름은 30자까지 쓸 수 있어요' })
    .regex(/^[a-zA-Z0-9._]+$/, {
      error: '사용자 이름은 영문, 숫자, 밑줄(_), 마침표(.)만 쓸 수 있어요',
    }),
  password: z.string().min(8, { error: '비밀번호는 8자 이상이어야 해요' }),
});

// 중복 확인은 쿼리 문자열로 받는다 — 무엇을(type) 어떤 값으로(value) 찾을지.
export const checkDuplicateSchema = z.object({
  type: z.enum(['email', 'phone', 'username']),
  value: z.string().trim().min(1),
});
