import { hash, verify } from '@node-rs/argon2'

const MEMORY_COST_KIB = 19456
const TIME_COST = 2
const PARALLELISM = 1

const options = {
  memoryCost: MEMORY_COST_KIB,
  timeCost: TIME_COST,
  parallelism: PARALLELISM,
}

export function hashPassword(password: string): Promise<string> {
  return hash(password, options)
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password)
  } catch {
    return false
  }
}

let dummyHash: Promise<string> | undefined

export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword('timing-equalizer-password')
  await verifyPassword(await dummyHash, password)
}
