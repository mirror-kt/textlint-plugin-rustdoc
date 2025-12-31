/**
 * filter out nullable
 *
 * @param value - any value
 * @returns return true if value is not null or undefined
 */
export const isNonNullable = <T>(
    value: T | null | undefined,
): value is NonNullable<T> => value !== null && value !== undefined;
