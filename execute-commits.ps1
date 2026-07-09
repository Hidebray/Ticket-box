$ErrorActionPreference = "Stop"

function Invoke-Git {
    param([string]$Arguments)
    $process = Start-Process git -ArgumentList $Arguments -NoNewWindow -Wait -PassThru
    if ($process.ExitCode -ne 0) {
        Write-Error "Git command failed with exit code $($process.ExitCode): git $Arguments"
        exit $process.ExitCode
    }
}

Write-Host "Running Commit 1..."
Invoke-Git "add -A src/data/ docker-compose.yml src/backend/.env.example src/backend/prisma/ src/backend/src/config/db.ts src/backend/src/config/queue.ts src/backend/src/config/redis.ts"
Invoke-Git "commit -m `"refactor(db): restructure database schema and update core configurations`""

Write-Host "Running Commit 2..."
Invoke-Git "add -A src/backend/src/controllers/user.controller.ts src/backend/src/routes/user.routes.ts src/backend/src/controllers/admin.controller.ts src/backend/src/routes/admin.routes.ts src/frontend/src/components/ProtectedRoute.tsx src/frontend/src/pages/AdminUsers.tsx src/frontend/src/utils/getErrorMessage.ts src/frontend/src/contexts/AuthContext.tsx src/frontend/src/App.tsx src/frontend/src/components/AdminLayout.tsx"
Invoke-Git "commit -m `"feat(admin): implement user management module and protected routes`""

Write-Host "Running Commit 3..."
Invoke-Git "add -A src/backend/src/app.ts src/backend/src/server.ts src/backend/src/worker.server.ts src/backend/src/routes/index.ts src/backend/src/routes/auth.routes.ts src/backend/src/routes/checkin.routes.ts src/backend/src/routes/worker.routes.ts src/backend/src/controllers/auth.controller.ts src/backend/src/controllers/checkin.controller.ts src/backend/src/controllers/concert.controller.ts src/backend/src/controllers/order.controller.ts src/backend/src/controllers/webhook.controller.ts src/backend/src/middlewares/ src/backend/src/services/ src/backend/src/workers/ src/backend/src/queue/ src/backend/src/tests/ src/backend/src/types/ src/backend/src/utils/ src/backend/src/config/worker.db.ts src/backend/package.json src/backend/package-lock.json"
Invoke-Git "commit -m `"refactor(backend): stabilize core APIs, middlewares, and worker services`""

Write-Host "Running Commit 4..."
Invoke-Git "add -A src/frontend/src/components/ src/frontend/src/pages/ src/frontend/src/index.css src/frontend/src/assets/ src/frontend/src/App.css src/frontend/public/"
Invoke-Git "commit -m `"refactor(frontend): clean up UI components, pages, and remove obsolete assets`""

Write-Host "Running Commit 5..."
Invoke-Git "add -A"
Invoke-Git "commit -m `"docs: update project documentation, e2e suite, and remove legacy files`""

Write-Host "Pushing to remote..."
Invoke-Git "push origin main"

Write-Host "All done successfully!"
