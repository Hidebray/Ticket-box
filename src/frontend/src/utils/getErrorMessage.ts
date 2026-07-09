export const getErrorMessage = (err: unknown, fallback = 'Có lỗi xảy ra, vui lòng thử lại'): string => {
    return (err as any)?.response?.data?.message || fallback;
};
