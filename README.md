# STMS Backend - Hệ thống Quản lý Thời khóa biểu Trường học

## Mô tả
STMS (School Timetable Management System) là hệ thống ERP giáo dục dành cho hệ thống trường tư thục tại Việt Nam.

## Công nghệ
- **Runtime**: Node.js 20 LTS
- **Framework**: NestJS 10.x
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL 16
- **ORM**: TypeORM 0.3.x
- **Cache**: Redis 7.x
- **Auth**: JWT + Passport

## Cài đặt

### Yêu cầu
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16 (hoặc dùng Docker)

### Bước 1: Clone và cài dependencies
```bash
cd stms-backend
npm install
```

### Bước 2: Khởi động infrastructure
```bash
cd docker
docker-compose up -d
```

### Bước 3: Cấu hình environment
```bash
cp .env.example .env
# Chỉnh sửa .env theo môi trường
```

### Bước 4: Chạy ứng dụng
```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## API Documentation
Swagger UI có tại: http://localhost:3000/api/docs

## Cấu trúc dự án
```
src/
├── common/          # Shared code (guards, filters, interceptors, DTOs)
├── config/          # Configuration files
├── modules/         # Feature modules
│   ├── auth/        # Authentication & Authorization
│   ├── school/      # School management
│   ├── academic/    # Academic year, semester, week, session, period
│   ├── class/       # Grade & Class
│   ├── teacher/     # Teacher management
│   ├── subject/     # Subject management
│   ├── room/        # Room management
│   ├── teaching-assignment/  # Teaching assignments
│   ├── timetable/   # Timetable (versions, slots, FET generation)
│   ├── import-export/  # Import/Export (Excel, PDF)
│   └── event/       # Events & Holidays
└── database/        # Migrations & Seeds
```

## Scripts
| Script | Mô tả |
|--------|--------|
| `npm run start:dev` | Chạy development mode (hot reload) |
| `npm run build` | Build production |
| `npm run start:prod` | Chạy production |
| `npm run test` | Chạy unit tests |
| `npm run test:e2e` | Chạy e2e tests |
| `npm run test:cov` | Test coverage |

## License
Private - All rights reserved.
