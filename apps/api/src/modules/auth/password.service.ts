import argon2 from "argon2";

const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  parallelism: 1,
  timeCost: 2,
  type: argon2.argon2id,
} satisfies argon2.Options;

export type PasswordService = {
  hashPassword: (password: string) => Promise<string>;
  verifyPassword: (hash: string, password: string) => Promise<boolean>;
};

export function createPasswordService(): PasswordService {
  return {
    async hashPassword(password) {
      return argon2.hash(password, ARGON2_OPTIONS);
    },
    async verifyPassword(hash, password) {
      try {
        return await argon2.verify(hash, password);
      } catch {
        return false;
      }
    },
  };
}
