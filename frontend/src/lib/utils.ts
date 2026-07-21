import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** 合并 tailwind 类名：clsx 处理条件，tailwind-merge 解决冲突（如 p-2 p-4 → p-4） */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
