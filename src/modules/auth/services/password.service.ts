import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * PasswordService — Dịch vụ hash và verify mật khẩu.
 *
 * Sử dụng Argon2id (khuyến nghị OWASP) thay vì bcrypt.
 * Argon2id kết hợp ưu điểm chống side-channel (Argon2i) và GPU attack (Argon2d).
 */
@Injectable()
export class PasswordService {
  /**
   * Hash mật khẩu bằng Argon2id.
   *
   * @param plainPassword Mật khẩu plaintext
   * @returns Chuỗi hash Argon2id
   */
  async hash(plainPassword: string): Promise<string> {
    return argon2.hash(plainPassword, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * So sánh mật khẩu plaintext với hash đã lưu.
   * Hỗ trợ cả Argon2 hash và bcrypt hash (backward compatible).
   *
   * @param plainPassword Mật khẩu plaintext
   * @param hashedPassword Hash đã lưu trong DB
   * @returns true nếu mật khẩu khớp
   */
  async verify(plainPassword: string, hashedPassword: string): Promise<boolean> {
    // Backward compatibility: nếu hash bắt đầu bằng $2b$ hoặc $2a$ → bcrypt legacy
    if (
      hashedPassword.startsWith('$2b$') ||
      hashedPassword.startsWith('$2a$')
    ) {
      // Lazy import bcrypt chỉ khi cần (backward compat)
      const bcrypt = await import('bcrypt');
      return bcrypt.compare(plainPassword, hashedPassword);
    }

    return argon2.verify(hashedPassword, plainPassword);
  }

  /**
   * Kiểm tra hash có cần rehash (upgrade từ bcrypt → argon2) không.
   *
   * @param hashedPassword Hash hiện tại
   * @returns true nếu hash cần upgrade
   */
  needsRehash(hashedPassword: string): boolean {
    return (
      hashedPassword.startsWith('$2b$') ||
      hashedPassword.startsWith('$2a$')
    );
  }
}
