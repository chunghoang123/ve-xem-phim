@echo off
chcp 65001 >nul
echo === CineX - Setup Database ===
echo.

echo 1. Tao database + bang + du lieu mau...
mysql -u root -p --default-character-set=utf8mb4 < "server\database\init.sql"
if %ERRORLEVEL% NEQ 0 (
    echo LOI: Khong the chay init.sql
    pause
    exit /b 1
)

echo.
echo 2. Them du lieu 63 tinh/126 rap/1134 suat chieu...
mysql -u root -p --default-character-set=utf8mb4 < "server\database\seed_63_provinces.sql"
if %ERRORLEVEL% NEQ 0 (
    echo LOI: Khong the chay seed_63_provinces.sql
    pause
    exit /b 1
)

echo.
echo === HOAN TAT ===
echo.
echo Tai khoan admin: admin@cinex.vn / admin123
echo.
echo Chay app: npm run dev:all
pause
