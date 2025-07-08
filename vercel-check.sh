#!/bin/bash

set -e  # Exit on any error (like Vercel)

echo "🚀 Running Vercel-style aggressive checks..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. TypeScript strict check
echo "1️⃣ TypeScript strict compilation check..."
if npx tsc --noEmit --strict --pretty; then
    echo "✅ TypeScript: No type errors"
else
    echo "❌ TypeScript: FAILED - Build would fail on Vercel"
    exit 1
fi

echo ""

# 2. ESLint with zero warnings tolerance
echo "2️⃣ ESLint check (zero warnings allowed)..."
if npx eslint . --ext .js,.jsx,.ts,.tsx --format=codeframe --color --max-warnings 0; then
    echo "✅ ESLint: No errors or warnings"
else
    echo "❌ ESLint: FAILED - Build would fail on Vercel" 
    exit 1
fi

echo ""

# 3. Next.js build check (optional - uncomment if you want full build test)
# echo "3️⃣ Next.js build test..."
# if npm run build > /dev/null 2>&1; then
#     echo "✅ Build: Successful"
#     rm -rf .next  # Clean up
# else
#     echo "❌ Build: FAILED"
#     exit 1
# fi

echo ""
echo "🎉 All checks passed! Your code would deploy successfully on Vercel."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
