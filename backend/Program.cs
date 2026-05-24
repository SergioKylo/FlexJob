using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = WebApplication.CreateBuilder(args);

// Add Services
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "FlexJobSession";
        options.LoginPath = "/login";
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    });
builder.Services.AddAuthorization();

var webApp = builder.Build();

// Initialize database
Database.Initialize();

// Serve Static Files
webApp.UseDefaultFiles();
webApp.UseStaticFiles();

webApp.UseAuthentication();
webApp.UseAuthorization();

// --- Authentication Endpoints ---

webApp.MapPost("/api/auth/register", async (HttpContext context, RegisterRequest request) =>
{
    if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Email) || 
        string.IsNullOrWhiteSpace(request.Password) || string.IsNullOrWhiteSpace(request.Role))
    {
        return Results.BadRequest(new { message = "Todos os campos são obrigatórios." });
    }

    if (request.Role != "worker" && request.Role != "employer")
    {
        return Results.BadRequest(new { message = "Função inválida. Escolha Trabalhador ou Empregador." });
    }

    // Check if email already exists
    var existing = Database.ExecuteQuery("SELECT id FROM users WHERE email = @email", new() { { "@email", request.Email } });
    if (existing.Count > 0)
    {
        return Results.BadRequest(new { message = "Este email já está registado." });
    }

    var passwordHash = PasswordHasher.Hash(request.Password);
    var createdAt = DateTime.UtcNow.ToString("o");

    try
    {
        Database.ExecuteNonQuery(
            @"INSERT INTO users (name, email, password_hash, role, avatar, bio, rating, location_lat, location_lng, created_at)
              VALUES (@name, @email, @hash, @role, @avatar, @bio, 5.0, @lat, @lng, @created_at)",
            new()
            {
                { "@name", request.Name },
                { "@email", request.Email },
                { "@hash", passwordHash },
                { "@role", request.Role },
                { "@avatar", $"https://api.dicebear.com/7.x/bottts/svg?seed={Uri.EscapeDataString(request.Name)}" },
                { "@bio", request.Bio ?? "" },
                { "@lat", request.Lat },
                { "@lng", request.Lng },
                { "@created_at", createdAt }
            });

        // If worker with hourly rate, create availability entry
        if (request.Role == "worker" && request.HourlyRate > 0)
        {
            var newUser = Database.ExecuteQuery("SELECT id FROM users WHERE email = @email", new() { { "@email", request.Email } });
            if (newUser.Count > 0)
            {
                var newUserId = Convert.ToInt32(newUser[0]["id"]);
                Database.ExecuteNonQuery(
                    @"INSERT INTO availabilities (worker_id, lat, lng, radius, start_time, end_time, hourly_rate, is_active)
                      VALUES (@workerId, @lat, @lng, 10.0, '09:00', '18:00', @hourlyRate, 1)
                      ON DUPLICATE KEY UPDATE hourly_rate = @hourlyRate",
                    new() { { "@workerId", newUserId }, { "@lat", request.Lat }, { "@lng", request.Lng }, { "@hourlyRate", request.HourlyRate } });
            }
        }

        return Results.Ok(new { message = "Conta criada com sucesso!" });
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message);
    }
});

webApp.MapPost("/api/auth/login", async (HttpContext context, LoginRequest request) =>
{
    if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
    {
        return Results.BadRequest(new { message = "Email e palavra-passe são obrigatórios." });
    }

    var users = Database.ExecuteQuery("SELECT * FROM users WHERE email = @email", new() { { "@email", request.Email } });
    if (users.Count == 0)
    {
        return Results.BadRequest(new { message = "Email ou palavra-passe incorretos." });
    }

    var user = users[0];
    var storedHash = user["password_hash"]?.ToString();

    if (!PasswordHasher.Verify(request.Password, storedHash))
    {
        return Results.BadRequest(new { message = "Email ou palavra-passe incorretos." });
    }

    // Sign in the user using Cookie authentication
    var claims = new List<Claim>
    {
        new Claim(ClaimTypes.NameIdentifier, user["id"].ToString()),
        new Claim(ClaimTypes.Name, user["name"].ToString()),
        new Claim(ClaimTypes.Role, user["role"].ToString()),
        new Claim(ClaimTypes.Email, user["email"].ToString())
    };

    var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
    var principal = new ClaimsPrincipal(identity);

    await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal);

    return Results.Ok(new
    {
        id = Convert.ToInt32(user["id"]),
        name = user["name"]?.ToString(),
        email = user["email"]?.ToString(),
        role = user["role"]?.ToString(),
        avatar = user["avatar"]?.ToString(),
        bio = user["bio"]?.ToString(),
        rating = Convert.ToDouble(user["rating"]),
        lat = user["location_lat"] != null && user["location_lat"] != DBNull.Value ? Convert.ToDouble(user["location_lat"]) : (double?)null,
        lng = user["location_lng"] != null && user["location_lng"] != DBNull.Value ? Convert.ToDouble(user["location_lng"]) : (double?)null
    });
});

webApp.MapPost("/api/auth/logout", async (HttpContext context) =>
{
    await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    return Results.Ok(new { message = "Sessão terminada." });
});

// Dev-only: force-reset admin password to 123456
webApp.MapGet("/api/setup/reset-admin", () =>
{
    try
    {
        string hash = PasswordHasher.Hash("123456");
        string now  = DateTime.UtcNow.ToString("o");
        var existing = Database.ExecuteQuery("SELECT id FROM users WHERE email = 'admin@flexjob.com'");
        if (existing.Count == 0)
        {
            Database.ExecuteNonQuery(
                @"INSERT INTO users (name, email, password_hash, role, avatar, bio, rating, wallet_balance, location_lat, location_lng, created_at)
                  VALUES ('Admin FlexJob', 'admin@flexjob.com', @hash, 'admin', 'https://i.pravatar.cc/150?img=8', 'Administrador da plataforma FlexJob.', 5.0, 0, 38.7169, -9.1399, @now)",
                new() { { "@hash", hash }, { "@now", now } });
            return Results.Ok(new { message = "Admin criado com password 123456." });
        }
        Database.ExecuteNonQuery(
            "UPDATE users SET password_hash = @hash, role = 'admin' WHERE email = 'admin@flexjob.com'",
            new() { { "@hash", hash } });
        return Results.Ok(new { message = "Password do admin redefinida para 123456." });
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message);
    }
});

webApp.MapGet("/api/auth/me", async (HttpContext context) =>
{
    if (context.User.Identity?.IsAuthenticated != true)
    {
        return Results.Unauthorized();
    }

    var userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    if (userId == null) return Results.Unauthorized();

    var users = Database.ExecuteQuery("SELECT id, name, email, role, avatar, bio, rating, location_lat, location_lng FROM users WHERE id = @id", new() { { "@id", userId } });
    if (users.Count == 0) return Results.NotFound();

    var user = users[0];
    return Results.Ok(new
    {
        id = Convert.ToInt32(user["id"]),
        name = user["name"]?.ToString(),
        email = user["email"]?.ToString(),
        role = user["role"]?.ToString(),
        avatar = user["avatar"]?.ToString(),
        bio = user["bio"]?.ToString(),
        rating = Convert.ToDouble(user["rating"]),
        lat = user["location_lat"] != null && user["location_lat"] != DBNull.Value ? Convert.ToDouble(user["location_lat"]) : (double?)null,
        lng = user["location_lng"] != null && user["location_lng"] != DBNull.Value ? Convert.ToDouble(user["location_lng"]) : (double?)null
    });
});

webApp.MapPost("/api/users/profile", (HttpContext context, ProfileUpdateRequest request) =>
{
    if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
    var userId = Convert.ToInt32(context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value);

    if (string.IsNullOrWhiteSpace(request.Name))
    {
        return Results.BadRequest(new { message = "O nome é obrigatório." });
    }

    // Use provided avatar (base64 or URL), or keep existing, or generate DiceBear
    string avatarValue;
    if (!string.IsNullOrWhiteSpace(request.Avatar))
    {
        avatarValue = request.Avatar;
    }
    else
    {
        var existing = Database.ExecuteQuery("SELECT avatar FROM users WHERE id = @id", new() { { "@id", userId } });
        var existingAvatar = existing.Count > 0 ? existing[0]["avatar"]?.ToString() : null;
        avatarValue = !string.IsNullOrWhiteSpace(existingAvatar)
            ? existingAvatar
            : $"https://api.dicebear.com/7.x/bottts/svg?seed={Uri.EscapeDataString(request.Name)}";
    }

    Database.ExecuteNonQuery(
        "UPDATE users SET name = @name, bio = @bio, avatar = @avatar WHERE id = @id",
        new()
        {
            { "@name", request.Name },
            { "@bio", request.Bio ?? "" },
            { "@avatar", avatarValue },
            { "@id", userId }
        });

    return Results.Ok(new { message = "Perfil atualizado com sucesso!", avatar = avatarValue });
});

webApp.MapGet("/api/users/reviews", (HttpContext context, int? userId) =>
{
    if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
    var currentUserId = Convert.ToInt32(context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
    var targetUserId = userId ?? currentUserId;

    var query = @"
        SELECT r.*, u.name as reviewer_name, u.avatar as reviewer_avatar
        FROM reviews r
        JOIN users u ON r.from_user_id = u.id
        WHERE r.to_user_id = @targetUserId
        ORDER BY r.created_at DESC";

    var reviews = Database.ExecuteQuery(query, new() { { "@targetUserId", targetUserId } });
    return Results.Ok(reviews);
});

// --- Jobs Endpoints ---

webApp.MapGet("/api/jobs", (HttpContext context, double? lat, double? lng, double? radius) =>
{
    // Retrieve open jobs
    string query = @"
        SELECT j.*, u.name as employer_name, u.avatar as employer_avatar, u.rating as employer_rating
        FROM jobs j
        JOIN users u ON j.employer_id = u.id
        WHERE j.status = 'open'";

    var jobs = Database.ExecuteQuery(query);
    var responseJobs = new List<object>();

    foreach (var job in jobs)
    {
        double jobLat = Convert.ToDouble(job["lat"]);
        double jobLng = Convert.ToDouble(job["lng"]);

        if (lat.HasValue && lng.HasValue && radius.HasValue)
        {
            // Simple distance check (Haversine formula approximated)
            double distance = GeoHelper.Distance(lat.Value, lng.Value, jobLat, jobLng);
            if (distance > radius.Value)
            {
                continue;
            }
        }

        responseJobs.Add(new
        {
            id = Convert.ToInt32(job["id"]),
            title = job["title"]?.ToString(),
            description = job["description"]?.ToString(),
            category = job["category"]?.ToString(),
            lat = jobLat,
            lng = jobLng,
            address = job["address"]?.ToString(),
            pay = Convert.ToDouble(job["pay"]),
            payType = job["pay_type"]?.ToString(),
            duration = job["duration"]?.ToString(),
            workDate = job.ContainsKey("work_date") ? job["work_date"]?.ToString() : "",
            status = job["status"]?.ToString(),
            employerId = Convert.ToInt32(job["employer_id"]),
            employerName = job["employer_name"]?.ToString(),
            employerAvatar = job["employer_avatar"]?.ToString(),
            employerRating = Convert.ToDouble(job["employer_rating"]),
            photo = job["photo"]?.ToString(),
            createdAt = job["created_at"]?.ToString()
        });
    }

    return Results.Ok(responseJobs);
});

webApp.MapPost("/api/jobs", async (HttpContext context, JobPostRequest request) =>
{
    if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
    
    var userId = Convert.ToInt32(context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
    var role = context.User.FindFirst(ClaimTypes.Role)?.Value;

    if (role != "employer")
    {
        return Results.Json(new { message = "Apenas empregadores podem publicar tarefas." }, statusCode: 403);
    }

    if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Description) || 
        string.IsNullOrWhiteSpace(request.Category) || request.Pay <= 0 || string.IsNullOrWhiteSpace(request.Address))
    {
        return Results.BadRequest(new { message = "Preencha todos os campos obrigatórios." });
    }

    var createdAt = DateTime.UtcNow.ToString("o");
    Database.ExecuteNonQuery(
        @"INSERT INTO jobs (title, description, category, lat, lng, address, pay, pay_type, duration, work_date, status, employer_id, photo, created_at)
          VALUES (@title, @description, @category, @lat, @lng, @address, @pay, @pay_type, @duration, @work_date, 'open', @employer_id, @photo, @created_at)",
        new()
        {
            { "@title", request.Title },
            { "@description", request.Description },
            { "@category", request.Category },
            { "@lat", request.Lat },
            { "@lng", request.Lng },
            { "@address", request.Address },
            { "@pay", request.Pay },
            { "@pay_type", request.PayType ?? "fixed" },
            { "@duration", request.Duration ?? "" },
            { "@work_date", request.WorkDate ?? "" },
            { "@employer_id", userId },
            { "@photo", request.Photo ?? "" },
            { "@created_at", createdAt }
        });

    return Results.Ok(new { message = "Tarefa publicada com sucesso!" });
});

webApp.MapGet("/api/jobs/my", (HttpContext context) =>
{
    if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
    var userId = Convert.ToInt32(context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
    var role = context.User.FindFirst(ClaimTypes.Role)?.Value;

    string query;
    if (role == "employer")
    {
        query = @"
            SELECT j.*, u.name as worker_name, u.avatar as worker_avatar
            FROM jobs j
            LEFT JOIN users u ON j.worker_id = u.id
            WHERE j.employer_id = @userId
            ORDER BY j.created_at DESC";
    }
    else
    {
        query = @"
            SELECT j.*, u.name as employer_name, u.avatar as employer_avatar
            FROM jobs j
            JOIN users u ON j.employer_id = u.id
            WHERE j.worker_id = @userId OR j.id IN (SELECT job_id FROM applications WHERE worker_id = @userId)
            ORDER BY j.created_at DESC";
    }

    var jobs = Database.ExecuteQuery(query, new() { { "@userId", userId } });
    var response = new List<object>();

    foreach (var job in jobs)
    {
        // Get applications for employers
        var appsCount = 0;
        if (role == "employer")
        {
            var apps = Database.ExecuteQuery("SELECT COUNT(*) as count FROM applications WHERE job_id = @jobId", new() { { "@jobId", job["id"] } });
            appsCount = Convert.ToInt32(apps[0]["count"]);
        }

        response.Add(new
        {
            id = Convert.ToInt32(job["id"]),
            title = job["title"]?.ToString(),
            description = job["description"]?.ToString(),
            category = job["category"]?.ToString(),
            lat = Convert.ToDouble(job["lat"]),
            lng = Convert.ToDouble(job["lng"]),
            address = job["address"]?.ToString(),
            pay = Convert.ToDouble(job["pay"]),
            payType = job["pay_type"]?.ToString(),
            duration = job["duration"]?.ToString(),
            status = job["status"]?.ToString(),
            employerId = Convert.ToInt32(job["employer_id"]),
            employerName = role == "worker" ? job["employer_name"]?.ToString() : null,
            employerAvatar = role == "worker" ? job["employer_avatar"]?.ToString() : null,
            workerId = job["worker_id"] != null ? Convert.ToInt32(job["worker_id"]) : (int?)null,
            workerName = role == "employer" ? job["worker_name"]?.ToString() : null,
            workerAvatar = role == "employer" ? job["worker_avatar"]?.ToString() : null,
            workDate = job.ContainsKey("work_date") ? job["work_date"]?.ToString() : "",
            applicationsCount = appsCount,
            photo = job["photo"]?.ToString(),
            createdAt = job["created_at"]?.ToString()
        });
    }

    return Results.Ok(response);
});

webApp.MapPost("/api/jobs/apply", (HttpContext context, ApplyRequest request) =>
{
    if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
    var userId = Convert.ToInt32(context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
    var role = context.User.FindFirst(ClaimTypes.Role)?.Value;

    if (role != "worker")
    {
        return Results.Json(new { message = "Apenas trabalhadores podem candidatar-se a tarefas." }, statusCode: 403);
    }

    var jobs = Database.ExecuteQuery("SELECT status, employer_id, title FROM jobs WHERE id = @id", new() { { "@id", request.JobId } });
    if (jobs.Count == 0) return Results.NotFound(new { message = "Tarefa não encontrada." });

    var job = jobs[0];
    if (job["status"]?.ToString() != "open")
    {
        return Results.BadRequest(new { message = "Esta tarefa já não está disponível." });
    }

    var createdAt = DateTime.UtcNow.ToString("o");
    try
    {
        Database.ExecuteNonQuery(
            @"INSERT IGNORE INTO applications (job_id, worker_id, status, created_at)
              VALUES (@jobId, @workerId, 'pending', @createdAt)",
            new()
            {
                { "@jobId", request.JobId },
                { "@workerId", userId },
                { "@createdAt", createdAt }
            });

        // Send application notification to employer (include worker profile info)
        var employerId = Convert.ToInt32(job["employer_id"]);
        var jobTitle = job["title"]?.ToString();
        var workerDetails = Database.ExecuteQuery(
            "SELECT u.name, u.bio, u.rating, a.hourly_rate FROM users u LEFT JOIN availabilities a ON u.id = a.worker_id WHERE u.id = @id",
            new() { { "@id", userId } });
        var wd = workerDetails.Count > 0 ? workerDetails[0] : null;
        var workerName = wd?["name"]?.ToString() ?? "Trabalhador";
        var workerBio = wd?["bio"]?.ToString() ?? "";
        var workerRating = wd != null && wd["rating"] != null ? Convert.ToDouble(wd["rating"]) : 5.0;
        var hourlyRate = wd != null && wd["hourly_rate"] != null && wd["hourly_rate"] != DBNull.Value ? Convert.ToDouble(wd["hourly_rate"]) : 0.0;
        var rateInfo = hourlyRate > 0 ? $" · €{hourlyRate:F2}/h" : "";
        var bioInfo = !string.IsNullOrWhiteSpace(workerBio) ? $"\n📝 {workerBio}" : "";
        var applyContent = $"📋 Candidatura de {workerName}\n⭐ {workerRating:F1}/5{rateInfo}{bioInfo}\nVaga: \"{jobTitle}\"";

        Database.ExecuteNonQuery(
            @"INSERT INTO messages (from_user_id, to_user_id, job_id, content, message_type, created_at)
              VALUES (@from, @to, @jobId, @content, 'application', @createdAt2)",
            new()
            {
                { "@from", userId },
                { "@to", employerId },
                { "@jobId", request.JobId },
                { "@content", applyContent },
                { "@createdAt2", DateTime.UtcNow.ToString("o") }
            });

        return Results.Ok(new { message = "Candidatura enviada com sucesso!", employerId });
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message);
    }
});

webApp.MapGet("/api/jobs/applications", (HttpContext context, int jobId) =>
{
    if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
    var userId = Convert.ToInt32(context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
    
    // Ensure the requester is the owner of the job
    var jobCheck = Database.ExecuteQuery("SELECT employer_id FROM jobs WHERE id = @jobId", new() { { "@jobId", jobId } });
    if (jobCheck.Count == 0) return Results.NotFound();
    if (Convert.ToInt32(jobCheck[0]["employer_id"]) != userId) return Results.Json(new { message = "Não autorizado." }, statusCode: 403);

    var apps = Database.ExecuteQuery(
        @"SELECT a.id, a.status, a.created_at, u.id as worker_id, u.name, u.avatar, u.rating, u.bio
          FROM applications a
          JOIN users u ON a.worker_id = u.id
          WHERE a.job_id = @jobId",
        new() { { "@jobId", jobId } });

    var response = new List<object>();
    foreach (var app in apps)
    {
        response.Add(new
        {
            id = Convert.ToInt32(app["id"]),
            status = app["status"]?.ToString(),
            createdAt = app["created_at"]?.ToString(),
            worker = new
            {
                id = Convert.ToInt32(app["worker_id"]),
                name = app["name"]?.ToString(),
                avatar = app["avatar"]?.ToString(),
                rating = Convert.ToDouble(app["rating"]),
                bio = app["bio"]?.ToString()
            }
        });
    }

    return Results.Ok(response);
});

webApp.MapPost("/api/jobs/applications/respond", (HttpContext context, RespondRequest request) =>
{
    if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
    var userId = Convert.ToInt32(context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value);

    // Get the application and check ownership of the job
    var apps = Database.ExecuteQuery(
        @"SELECT a.*, j.employer_id, j.status as job_status 
          FROM applications a
          JOIN jobs j ON a.job_id = j.id
          WHERE a.id = @appId",
        new() { { "@appId", request.ApplicationId } });

    if (apps.Count == 0) return Results.NotFound(new { message = "Candidatura não encontrada." });
    var appRow = apps[0];

    if (Convert.ToInt32(appRow["employer_id"]) != userId)
    {
        return Results.Json(new { message = "Não autorizado." }, statusCode: 403);
    }

    if (appRow["job_status"]?.ToString() != "open")
    {
        return Results.BadRequest(new { message = "Esta tarefa já foi preenchida ou concluída." });
    }

    if (request.Accept)
    {
        // Update application
        Database.ExecuteNonQuery("UPDATE applications SET status = 'accepted' WHERE id = @appId", new() { { "@appId", request.ApplicationId } });
        // Reject others
        Database.ExecuteNonQuery("UPDATE applications SET status = 'rejected' WHERE id != @appId AND job_id = @jobId", new() { { "@appId", request.ApplicationId }, { "@jobId", appRow["job_id"] } });
        // Update Job with worker
        Database.ExecuteNonQuery(
            "UPDATE jobs SET status = 'accepted', worker_id = @workerId WHERE id = @jobId",
            new()
            {
                { "@workerId", appRow["worker_id"] },
                { "@jobId", appRow["job_id"] }
            });

        // Send a system message or init chat
        var systemMsg = "Olá! Aceitei a tua candidatura para esta tarefa. Vamos coordenar os detalhes!";
        Database.ExecuteNonQuery(
            @"INSERT INTO messages (from_user_id, to_user_id, job_id, content, created_at)
              VALUES (@from, @to, @jobId, @content, @createdAt)",
            new()
            {
                { "@from", userId },
                { "@to", appRow["worker_id"] },
                { "@jobId", appRow["job_id"] },
                { "@content", systemMsg },
                { "@createdAt", DateTime.UtcNow.ToString("o") }
            });
    }
    else
    {
        Database.ExecuteNonQuery("UPDATE applications SET status = 'rejected' WHERE id = @appId", new() { { "@appId", request.ApplicationId } });
    }

    return Results.Ok(new { message = "Candidatura respondida com sucesso!" });
});

webApp.MapPost("/api/jobs/complete", (HttpContext context, CompleteJobRequest request) =>
{
    if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
    var userId = Convert.ToInt32(context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value);

    // Ensure the requester is the employer of the job
    var jobs = Database.ExecuteQuery("SELECT employer_id, worker_id, status FROM jobs WHERE id = @jobId", new() { { "@jobId", request.JobId } });
    if (jobs.Count == 0) return Results.NotFound(new { message = "Tarefa não encontrada." });
    
    var job = jobs[0];
    if (Convert.ToInt32(job["employer_id"]) != userId) return Results.Json(new { message = "Não autorizado." }, statusCode: 403);
    if (job["status"]?.ToString() == "completed") return Results.BadRequest(new { message = "A tarefa já está concluída." });

    var workerIdVal = job["worker_id"];
    if (workerIdVal == null || workerIdVal == DBNull.Value)
    {
        return Results.BadRequest(new { message = "Não podes concluir uma tarefa que não tem trabalhador atribuído." });
    }
    var workerId = Convert.ToInt32(workerIdVal);

    // Update job status
    Database.ExecuteNonQuery("UPDATE jobs SET status = 'completed' WHERE id = @jobId", new() { { "@jobId", request.JobId } });

    // Insert review
    Database.ExecuteNonQuery(
        @"INSERT INTO reviews (job_id, from_user_id, to_user_id, rating, comment, created_at)
          VALUES (@jobId, @from, @to, @rating, @comment, @createdAt)",
        new()
        {
            { "@jobId", request.JobId },
            { "@from", userId },
            { "@to", workerId },
            { "@rating", Math.Clamp(request.Rating, 1.0, 5.0) },
            { "@comment", request.Comment ?? "" },
            { "@createdAt", DateTime.UtcNow.ToString("o") }
        });

    // Recalculate average rating of worker
    var ratings = Database.ExecuteQuery("SELECT AVG(rating) as avg_rating FROM reviews WHERE to_user_id = @workerId", new() { { "@workerId", workerId } });
    if (ratings.Count > 0 && ratings[0]["avg_rating"] != null && ratings[0]["avg_rating"] != DBNull.Value)
    {
        double avgRating = Convert.ToDouble(ratings[0]["avg_rating"]);
        Database.ExecuteNonQuery("UPDATE users SET rating = @rating WHERE id = @workerId", new() { { "@rating", avgRating }, { "@workerId", workerId } });
    }

    return Results.Ok(new { message = "Tarefa concluída e avaliação registada com sucesso!" });
});

// --- Workers/Availability Endpoints ---

webApp.MapGet("/api/workers", (HttpContext context, double? lat, double? lng, double? radius) =>
{
    // Retrieve active worker availabilities
    string query = @"
        SELECT a.*, u.name, u.avatar, u.rating, u.bio
        FROM availabilities a
        JOIN users u ON a.worker_id = u.id
        WHERE a.is_active = 1";

    var workers = Database.ExecuteQuery(query);
    var response = new List<object>();

    foreach (var w in workers)
    {
        double wLat = Convert.ToDouble(w["lat"]);
        double wLng = Convert.ToDouble(w["lng"]);

        if (lat.HasValue && lng.HasValue && radius.HasValue)
        {
            double distance = GeoHelper.Distance(lat.Value, lng.Value, wLat, wLng);
            if (distance > radius.Value)
            {
                continue;
            }
        }

        response.Add(new
        {
            id = Convert.ToInt32(w["id"]),
            workerId = Convert.ToInt32(w["worker_id"]),
            name = w["name"]?.ToString(),
            avatar = w["avatar"]?.ToString(),
            rating = Convert.ToDouble(w["rating"]),
            bio = w["bio"]?.ToString(),
            lat = wLat,
            lng = wLng,
            radius = Convert.ToDouble(w["radius"]),
            startTime = w["start_time"]?.ToString(),
            endTime = w["end_time"]?.ToString(),
            hourlyRate = Convert.ToDouble(w["hourly_rate"]),
            isActive = Convert.ToInt32(w["is_active"]) == 1
        });
    }

    return Results.Ok(response);
});

webApp.MapPost("/api/workers/availability", (HttpContext context, AvailabilityRequest request) =>
{
    if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
    var userId = Convert.ToInt32(context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
    var role = context.User.FindFirst(ClaimTypes.Role)?.Value;

    if (role != "worker")
    {
        return Results.Json(new { message = "Apenas trabalhadores podem definir disponibilidade." }, statusCode: 403);
    }

    // Insert or replace availability in MySQL using ON DUPLICATE KEY UPDATE
    Database.ExecuteNonQuery(
        @"INSERT INTO availabilities (worker_id, lat, lng, radius, start_time, end_time, hourly_rate, is_active)
          VALUES (@workerId, @lat, @lng, @radius, @startTime, @endTime, @hourlyRate, @isActive)
          ON DUPLICATE KEY UPDATE lat = @lat, lng = @lng, radius = @radius, start_time = @startTime, end_time = @endTime, hourly_rate = @hourlyRate, is_active = @isActive",
        new()
        {
            { "@workerId", userId },
            { "@lat", request.Lat },
            { "@lng", request.Lng },
            { "@radius", request.Radius },
            { "@startTime", request.StartTime ?? "" },
            { "@endTime", request.EndTime ?? "" },
            { "@hourlyRate", request.HourlyRate },
            { "@isActive", request.IsActive ? 1 : 0 }
        });

    // Also update the user's main location so the map reflects the new region
    Database.ExecuteNonQuery(
        "UPDATE users SET location_lat = @lat, location_lng = @lng WHERE id = @userId",
        new() { { "@lat", request.Lat }, { "@lng", request.Lng }, { "@userId", userId } });

    return Results.Ok(new { message = "Disponibilidade atualizada!" });
});

// --- Messages Endpoints ---

webApp.MapGet("/api/messages/inbox", (HttpContext context) =>
{
    if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
    var userId = Convert.ToInt32(context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value);

    var conversations = Database.ExecuteQuery(
        @"SELECT 
              m.job_id,
              j.title as job_title,
              u.id as partner_id,
              u.name as partner_name,
              u.avatar as partner_avatar,
              u.role as partner_role,
              m.content as last_message,
              m.created_at as last_message_time
          FROM messages m
          LEFT JOIN jobs j ON m.job_id = j.id
          JOIN users u ON u.id = CASE WHEN m.from_user_id = @userId THEN m.to_user_id ELSE m.from_user_id END
          WHERE m.id IN (
              SELECT MAX(id)
              FROM messages
              WHERE from_user_id = @userId OR to_user_id = @userId
              GROUP BY COALESCE(job_id, 0), CASE WHEN from_user_id = @userId THEN to_user_id ELSE from_user_id END
          )
          ORDER BY m.created_at DESC",
        new() { { "@userId", userId } });

    var response = new List<object>();
    foreach (var c in conversations)
    {
        response.Add(new
        {
            jobId = c["job_id"] != null ? Convert.ToInt32(c["job_id"]) : 0,
            jobTitle = c["job_title"]?.ToString() ?? "Contacto Direto",
            partnerId = Convert.ToInt32(c["partner_id"]),
            partnerName = c["partner_name"]?.ToString(),
            partnerAvatar = c["partner_avatar"]?.ToString(),
            partnerRole = c["partner_role"]?.ToString(),
            lastMessage = c["last_message"]?.ToString(),
            lastMessageTime = c["last_message_time"]?.ToString()
        });
    }

    return Results.Ok(response);
});

webApp.MapGet("/api/messages", (HttpContext context, int partnerId, int? jobId) =>
{
    if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
    var userId = Convert.ToInt32(context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value);

    // Get messages between the logged-in user and the partner, optionally filtered by jobId
    string query = @"
        SELECT m.*, u_from.name as from_name, u_to.name as to_name
        FROM messages m
        JOIN users u_from ON m.from_user_id = u_from.id
        JOIN users u_to ON m.to_user_id = u_to.id
        WHERE ((m.from_user_id = @userId AND m.to_user_id = @partnerId)
           OR (m.from_user_id = @partnerId AND m.to_user_id = @userId))";

    var parameters = new Dictionary<string, object>
    {
        { "@userId", userId },
        { "@partnerId", partnerId }
    };

    if (jobId.HasValue && jobId.Value > 0)
    {
        query += " AND m.job_id = @jobId";
        parameters.Add("@jobId", jobId.Value);
    }

    query += " ORDER BY m.created_at ASC";

    var msgs = Database.ExecuteQuery(query, parameters);
    var response = new List<object>();
    foreach (var m in msgs)
    {
        response.Add(new
        {
            id = Convert.ToInt32(m["id"]),
            fromUserId = Convert.ToInt32(m["from_user_id"]),
            toUserId = Convert.ToInt32(m["to_user_id"]),
            jobId = m["job_id"] != null && m["job_id"] != DBNull.Value ? Convert.ToInt32(m["job_id"]) : (int?)null,
            fromName = m["from_name"]?.ToString(),
            toName = m["to_name"]?.ToString(),
            content = m["content"]?.ToString(),
            messageType = m.ContainsKey("message_type") ? m["message_type"]?.ToString() ?? "text" : "text",
            createdAt = m["created_at"]?.ToString()
        });
    }

    return Results.Ok(response);
});

webApp.MapPost("/api/messages", (HttpContext context, MessageRequest request) =>
{
    if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
    var userId = Convert.ToInt32(context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value);

    if (string.IsNullOrWhiteSpace(request.Content))
    {
        return Results.BadRequest(new { message = "A mensagem não pode estar vazia." });
    }

    var createdAt = DateTime.UtcNow.ToString("o");
    Database.ExecuteNonQuery(
        @"INSERT INTO messages (from_user_id, to_user_id, job_id, content, created_at)
          VALUES (@from, @to, @jobId, @content, @createdAt)",
        new()
        {
            { "@from", userId },
            { "@to", request.ToUserId },
            { "@jobId", request.JobId.HasValue && request.JobId.Value > 0 ? (object)request.JobId.Value : DBNull.Value },
            { "@content", request.Content },
            { "@createdAt", createdAt }
        });

    return Results.Ok(new { message = "Mensagem enviada." });
});

// --- Job Detail Endpoint ---

webApp.MapGet("/api/jobs/detail", (HttpContext context, int jobId) =>
{
    if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();

    var jobs = Database.ExecuteQuery(
        @"SELECT j.*, e.name as employer_name, w.name as worker_name
          FROM jobs j
          JOIN users e ON j.employer_id = e.id
          LEFT JOIN users w ON j.worker_id = w.id
          WHERE j.id = @jobId",
        new() { { "@jobId", jobId } });

    if (jobs.Count == 0) return Results.NotFound(new { message = "Trabalho não encontrado." });
    var job = jobs[0];

    return Results.Ok(new
    {
        id = Convert.ToInt32(job["id"]),
        title = job["title"]?.ToString(),
        pay = Convert.ToDouble(job["pay"]),
        duration = job["duration"]?.ToString(),
        status = job["status"]?.ToString(),
        paymentStatus = job.ContainsKey("payment_status") ? job["payment_status"]?.ToString() ?? "none" : "none",
        employerId = Convert.ToInt32(job["employer_id"]),
        employerName = job["employer_name"]?.ToString(),
        workerId = job["worker_id"] != null && job["worker_id"] != DBNull.Value ? Convert.ToInt32(job["worker_id"]) : (int?)null,
        workerName = job["worker_name"]?.ToString(),
    });
});

// --- Payment Endpoints ---

webApp.MapPost("/api/payments/escrow", (HttpContext context, EscrowRequest request) =>
{
    if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
    var userId = Convert.ToInt32(context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
    var role = context.User.FindFirst(ClaimTypes.Role)?.Value;

    if (role != "employer")
        return Results.Json(new { message = "Apenas empreendedores podem efetuar pagamentos." }, statusCode: 403);

    var jobs = Database.ExecuteQuery("SELECT * FROM jobs WHERE id = @jobId", new() { { "@jobId", request.JobId } });
    if (jobs.Count == 0) return Results.NotFound(new { message = "Trabalho não encontrado." });
    var job = jobs[0];

    if (Convert.ToInt32(job["employer_id"]) != userId)
        return Results.Json(new { message = "Não autorizado." }, statusCode: 403);

    var paymentStatus = job.ContainsKey("payment_status") ? job["payment_status"]?.ToString() ?? "none" : "none";
    if (paymentStatus != "none")
        return Results.BadRequest(new { message = "Pagamento já foi efetuado para esta tarefa." });

    var workerId = job["worker_id"] != null && job["worker_id"] != DBNull.Value ? Convert.ToInt32(job["worker_id"]) : (int?)null;
    if (workerId == null)
        return Results.BadRequest(new { message = "Ainda não há trabalhador atribuído. Aceite primeiro uma candidatura." });

    var hourlyRate = Convert.ToDouble(job["pay"]);
    var hours = request.Hours > 0 ? request.Hours : 1.0;
    var amount = hours * hourlyRate;

    Database.ExecuteNonQuery(
        "UPDATE jobs SET payment_status = 'escrowed', payment_amount = @amount WHERE id = @jobId",
        new() { { "@jobId", request.JobId }, { "@amount", amount } });

    var dateInfo = !string.IsNullOrWhiteSpace(request.WorkDate) ? $" para {request.WorkDate}" : "";
    var notesInfo = !string.IsNullOrWhiteSpace(request.Notes) ? $"\n📝 {request.Notes}" : "";
    var escrowContent = $"💰 €{amount:F2} depositados em garantia ({hours}h × €{hourlyRate:F2}/h){dateInfo}. Pode iniciar o trabalho!{notesInfo}";

    Database.ExecuteNonQuery(
        @"INSERT INTO messages (from_user_id, to_user_id, job_id, content, message_type, created_at)
          VALUES (@from, @to, @jobId, @content, 'payment_escrow', @createdAt)",
        new()
        {
            { "@from", userId },
            { "@to", workerId },
            { "@jobId", request.JobId },
            { "@content", escrowContent },
            { "@createdAt", DateTime.UtcNow.ToString("o") }
        });

    return Results.Ok(new { message = "Pagamento depositado em garantia com sucesso!", amount });
});

webApp.MapPost("/api/payments/release", (HttpContext context, ReleasePaymentRequest request) =>
{
    if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
    var userId = Convert.ToInt32(context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
    var role = context.User.FindFirst(ClaimTypes.Role)?.Value;

    if (role != "employer")
        return Results.Json(new { message = "Apenas empreendedores podem confirmar a conclusão." }, statusCode: 403);

    var jobs = Database.ExecuteQuery("SELECT * FROM jobs WHERE id = @jobId", new() { { "@jobId", request.JobId } });
    if (jobs.Count == 0) return Results.NotFound(new { message = "Trabalho não encontrado." });
    var job = jobs[0];

    if (Convert.ToInt32(job["employer_id"]) != userId)
        return Results.Json(new { message = "Não autorizado." }, statusCode: 403);

    var paymentStatus = job.ContainsKey("payment_status") ? job["payment_status"]?.ToString() ?? "none" : "none";
    if (paymentStatus != "escrowed")
        return Results.BadRequest(new { message = "O pagamento em garantia ainda não foi efetuado." });

    var workerIdRaw = job["worker_id"];
    if (workerIdRaw == null || workerIdRaw == DBNull.Value)
        return Results.BadRequest(new { message = "Não podes confirmar um pagamento sem trabalhador atribuído." });
    var workerId = Convert.ToInt32(workerIdRaw);
    var paymentAmountRaw = job.ContainsKey("payment_amount") && job["payment_amount"] != null && job["payment_amount"] != DBNull.Value ? Convert.ToDouble(job["payment_amount"]) : 0;
    var pay = paymentAmountRaw > 0 ? paymentAmountRaw : Convert.ToDouble(job["pay"]);

    Database.ExecuteNonQuery(
        "UPDATE jobs SET status = 'completed', payment_status = 'released' WHERE id = @jobId",
        new() { { "@jobId", request.JobId } });

    Database.ExecuteNonQuery(
        "UPDATE users SET wallet_balance = wallet_balance + @amount WHERE id = @workerId",
        new() { { "@amount", pay }, { "@workerId", workerId } });

    if (request.Rating > 0)
    {
        var now2 = DateTime.UtcNow.ToString("o");
        Database.ExecuteNonQuery(
            @"INSERT INTO reviews (job_id, from_user_id, to_user_id, rating, comment, created_at)
              VALUES (@jobId, @from, @to, @rating, @comment, @createdAt)",
            new()
            {
                { "@jobId", request.JobId },
                { "@from", userId },
                { "@to", workerId },
                { "@rating", Math.Clamp(request.Rating, 1.0, 5.0) },
                { "@comment", request.Comment ?? "" },
                { "@createdAt", now2 }
            });

        var ratings = Database.ExecuteQuery("SELECT AVG(rating) as avg_rating FROM reviews WHERE to_user_id = @workerId", new() { { "@workerId", workerId } });
        if (ratings.Count > 0 && ratings[0]["avg_rating"] != null && ratings[0]["avg_rating"] != DBNull.Value)
        {
            double avg = Convert.ToDouble(ratings[0]["avg_rating"]);
            Database.ExecuteNonQuery("UPDATE users SET rating = @rating WHERE id = @workerId", new() { { "@rating", avg }, { "@workerId", workerId } });
        }
    }

    Database.ExecuteNonQuery(
        @"INSERT INTO messages (from_user_id, to_user_id, job_id, content, message_type, created_at)
          VALUES (@from, @to, @jobId, @content, 'payment_released', @createdAt)",
        new()
        {
            { "@from", userId },
            { "@to", workerId },
            { "@jobId", request.JobId },
            { "@content", $"🎉 Trabalho concluído! €{pay:F2} creditados na sua carteira." },
            { "@createdAt", DateTime.UtcNow.ToString("o") }
        });

    return Results.Ok(new { message = "Pagamento libertado e trabalho concluído!", amount = pay });
});

// --- Accept Worker Directly (from chat) ---

webApp.MapPost("/api/jobs/accept-worker", (HttpContext context, AcceptWorkerRequest request) =>
{
    if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
    var userId = Convert.ToInt32(context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
    var role = context.User.FindFirst(ClaimTypes.Role)?.Value;

    if (role != "employer")
        return Results.Json(new { message = "Apenas empreendedores podem aceitar candidaturas." }, statusCode: 403);

    var apps = Database.ExecuteQuery(
        @"SELECT a.id, j.employer_id, j.status as job_status FROM applications a
          JOIN jobs j ON a.job_id = j.id
          WHERE a.job_id = @jobId AND a.worker_id = @workerId",
        new() { { "@jobId", request.JobId }, { "@workerId", request.WorkerId } });

    if (apps.Count == 0) return Results.NotFound(new { message = "Candidatura não encontrada." });
    var app = apps[0];

    if (Convert.ToInt32(app["employer_id"]) != userId)
        return Results.Json(new { message = "Não autorizado." }, statusCode: 403);

    if (app["job_status"]?.ToString() == "accepted")
        return Results.BadRequest(new { message = "Este trabalho já tem um trabalhador aceite." });

    var appId = Convert.ToInt32(app["id"]);

    if (request.Accept)
    {
        Database.ExecuteNonQuery("UPDATE applications SET status = 'accepted' WHERE id = @appId", new() { { "@appId", appId } });
        Database.ExecuteNonQuery("UPDATE applications SET status = 'rejected' WHERE id != @appId AND job_id = @jobId",
            new() { { "@appId", appId }, { "@jobId", request.JobId } });
        Database.ExecuteNonQuery("UPDATE jobs SET status = 'accepted', worker_id = @workerId WHERE id = @jobId",
            new() { { "@workerId", request.WorkerId }, { "@jobId", request.JobId } });

        Database.ExecuteNonQuery(
            @"INSERT INTO messages (from_user_id, to_user_id, job_id, content, created_at)
              VALUES (@from, @to, @jobId, @content, @createdAt)",
            new()
            {
                { "@from", userId },
                { "@to", request.WorkerId },
                { "@jobId", request.JobId },
                { "@content", "✅ Candidatura aceite! Aguarda o depósito em garantia antes de iniciar o trabalho." },
                { "@createdAt", DateTime.UtcNow.ToString("o") }
            });
    }
    else
    {
        Database.ExecuteNonQuery("UPDATE applications SET status = 'rejected' WHERE id = @appId", new() { { "@appId", appId } });
    }

    return Results.Ok(new { message = request.Accept ? "Candidatura aceite com sucesso!" : "Candidatura rejeitada." });
});

// --- Tip Endpoint ---

webApp.MapPost("/api/payments/tip", (HttpContext context, TipRequest request) =>
{
    if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
    var userId = Convert.ToInt32(context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
    var role = context.User.FindFirst(ClaimTypes.Role)?.Value;

    if (role != "employer")
        return Results.Json(new { message = "Apenas empreendedores podem dar gorjeta." }, statusCode: 403);

    if (request.Amount <= 0)
        return Results.BadRequest(new { message = "Valor de gorjeta inválido." });

    var jobs = Database.ExecuteQuery("SELECT worker_id, employer_id, payment_status FROM jobs WHERE id = @jobId",
        new() { { "@jobId", request.JobId } });
    if (jobs.Count == 0) return Results.NotFound(new { message = "Trabalho não encontrado." });
    var job = jobs[0];

    if (Convert.ToInt32(job["employer_id"]) != userId)
        return Results.Json(new { message = "Não autorizado." }, statusCode: 403);

    var paymentStatus = job["payment_status"]?.ToString() ?? "none";
    if (paymentStatus != "released")
        return Results.BadRequest(new { message = "Só pode dar gorjeta depois do pagamento ser confirmado." });

    var workerId = Convert.ToInt32(job["worker_id"]);
    Database.ExecuteNonQuery("UPDATE users SET wallet_balance = wallet_balance + @amount WHERE id = @workerId",
        new() { { "@amount", request.Amount }, { "@workerId", workerId } });

    Database.ExecuteNonQuery(
        @"INSERT INTO messages (from_user_id, to_user_id, job_id, content, message_type, created_at)
          VALUES (@from, @to, @jobId, @content, 'payment_released', @createdAt)",
        new()
        {
            { "@from", userId },
            { "@to", workerId },
            { "@jobId", request.JobId },
            { "@content", $"🎁 Gorjeta de €{request.Amount:F2} recebida! Obrigado pelo excelente trabalho!" },
            { "@createdAt", DateTime.UtcNow.ToString("o") }
        });

    return Results.Ok(new { message = "Gorjeta enviada com sucesso!", amount = request.Amount });
});

// --- Update Job (Employer) ---

webApp.MapPost("/api/jobs/update", (HttpContext context, UpdateJobRequest request) =>
{
    if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
    var userId = Convert.ToInt32(context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
    var role = context.User.FindFirst(ClaimTypes.Role)?.Value;

    if (role != "employer")
        return Results.Json(new { message = "Apenas empreendedores podem editar vagas." }, statusCode: 403);

    var jobs = Database.ExecuteQuery("SELECT employer_id, status FROM jobs WHERE id = @id", new() { { "@id", request.JobId } });
    if (jobs.Count == 0) return Results.NotFound(new { message = "Vaga não encontrada." });
    if (Convert.ToInt32(jobs[0]["employer_id"]) != userId)
        return Results.Json(new { message = "Não autorizado." }, statusCode: 403);
    if (jobs[0]["status"]?.ToString() == "closed" || jobs[0]["status"]?.ToString() == "completed")
        return Results.BadRequest(new { message = "Não é possível editar uma vaga fechada ou concluída." });

    Database.ExecuteNonQuery(
        @"UPDATE jobs SET title = @title, description = @desc, pay = @pay,
          duration = @duration, work_date = @workDate, address = @address WHERE id = @id",
        new()
        {
            { "@title", request.Title },
            { "@desc", request.Description },
            { "@pay", request.Pay },
            { "@duration", request.Duration },
            { "@workDate", request.WorkDate ?? "" },
            { "@address", request.Address ?? "" },
            { "@id", request.JobId }
        });

    return Results.Ok(new { message = "Vaga atualizada com sucesso." });
});

// --- Close Job (Employer) ---

webApp.MapPost("/api/jobs/close", (HttpContext context, CloseJobRequest request) =>
{
    if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
    var userId = Convert.ToInt32(context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
    var role = context.User.FindFirst(ClaimTypes.Role)?.Value;

    if (role != "employer")
        return Results.Json(new { message = "Apenas empreendedores podem fechar vagas." }, statusCode: 403);

    var jobs = Database.ExecuteQuery("SELECT employer_id FROM jobs WHERE id = @id", new() { { "@id", request.JobId } });
    if (jobs.Count == 0) return Results.NotFound(new { message = "Vaga não encontrada." });
    if (Convert.ToInt32(jobs[0]["employer_id"]) != userId)
        return Results.Json(new { message = "Não autorizado." }, statusCode: 403);

    Database.ExecuteNonQuery("UPDATE jobs SET status = 'closed' WHERE id = @id", new() { { "@id", request.JobId } });
    return Results.Ok(new { message = "Vaga fechada com sucesso." });
});

// --- Worker Review (worker rates employer after job done) ---

webApp.MapPost("/api/payments/worker-review", (HttpContext context, WorkerReviewRequest request) =>
{
    if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
    var userId = Convert.ToInt32(context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
    var role = context.User.FindFirst(ClaimTypes.Role)?.Value;

    if (role != "worker")
        return Results.Json(new { message = "Apenas trabalhadores podem usar este endpoint." }, statusCode: 403);

    var jobs = Database.ExecuteQuery("SELECT employer_id, worker_id, payment_status FROM jobs WHERE id = @id", new() { { "@id", request.JobId } });
    if (jobs.Count == 0) return Results.NotFound(new { message = "Trabalho não encontrado." });
    var job = jobs[0];

    var workerIdCheck = job["worker_id"];
    if (workerIdCheck == null || workerIdCheck == DBNull.Value || Convert.ToInt32(workerIdCheck) != userId)
        return Results.Json(new { message = "Não autorizado." }, statusCode: 403);
    if (job["payment_status"]?.ToString() != "released")
        return Results.BadRequest(new { message = "O pagamento ainda não foi confirmado." });

    var employerId = Convert.ToInt32(job["employer_id"]);

    // Check if already reviewed
    var existing = Database.ExecuteQuery(
        "SELECT id FROM reviews WHERE job_id = @jobId AND from_user_id = @from",
        new() { { "@jobId", request.JobId }, { "@from", userId } });
    if (existing.Count > 0) return Results.BadRequest(new { message = "Já avaliou este trabalho." });

    Database.ExecuteNonQuery(
        @"INSERT INTO reviews (job_id, from_user_id, to_user_id, rating, comment, created_at)
          VALUES (@jobId, @from, @to, @rating, @comment, @createdAt)",
        new()
        {
            { "@jobId", request.JobId },
            { "@from", userId },
            { "@to", employerId },
            { "@rating", Math.Clamp(request.Rating, 1.0, 5.0) },
            { "@comment", request.Comment ?? "" },
            { "@createdAt", DateTime.UtcNow.ToString("o") }
        });

    // Update employer's average rating
    var ratings = Database.ExecuteQuery("SELECT AVG(rating) as avg_rating FROM reviews WHERE to_user_id = @id", new() { { "@id", employerId } });
    if (ratings.Count > 0 && ratings[0]["avg_rating"] != null && ratings[0]["avg_rating"] != DBNull.Value)
    {
        double avg = Convert.ToDouble(ratings[0]["avg_rating"]);
        Database.ExecuteNonQuery("UPDATE users SET rating = @rating WHERE id = @id", new() { { "@rating", avg }, { "@id", employerId } });
    }

    return Results.Ok(new { message = "Avaliação enviada! Obrigado pelo feedback." });
});

// --- Admin Endpoints ---

webApp.MapGet("/api/admin/stats", (HttpContext context) =>
{
    if (!AdminHelper.IsAdmin(context)) return Results.Forbid();

    var userCount    = Convert.ToInt32(Database.ExecuteQuery("SELECT COUNT(*) as c FROM users WHERE role != 'admin'")[0]["c"]);
    var workerCount  = Convert.ToInt32(Database.ExecuteQuery("SELECT COUNT(*) as c FROM users WHERE role = 'worker'")[0]["c"]);
    var empCount     = Convert.ToInt32(Database.ExecuteQuery("SELECT COUNT(*) as c FROM users WHERE role = 'employer'")[0]["c"]);
    var totalJobs    = Convert.ToInt32(Database.ExecuteQuery("SELECT COUNT(*) as c FROM jobs")[0]["c"]);
    var activeJobs   = Convert.ToInt32(Database.ExecuteQuery("SELECT COUNT(*) as c FROM jobs WHERE status = 'open'")[0]["c"]);
    var totalMsgs    = Convert.ToInt32(Database.ExecuteQuery("SELECT COUNT(*) as c FROM messages WHERE message_type = 'text'")[0]["c"]);
    var revRows      = Database.ExecuteQuery("SELECT COALESCE(SUM(payment_amount),0) as r FROM jobs WHERE payment_status = 'released'");
    var revenue      = revRows.Count > 0 ? Convert.ToDouble(revRows[0]["r"]) : 0.0;

    return Results.Ok(new { userCount, workerCount, employerCount = empCount, totalJobs, activeJobs, totalMessages = totalMsgs, revenue });
});

webApp.MapGet("/api/admin/users", (HttpContext context) =>
{
    if (!AdminHelper.IsAdmin(context)) return Results.Forbid();

    var rows = Database.ExecuteQuery(
        "SELECT id, name, email, role, avatar, bio, rating, wallet_balance, created_at FROM users ORDER BY created_at DESC");

    return Results.Ok(rows.Select(u => new {
        id            = Convert.ToInt32(u["id"]),
        name          = u["name"]?.ToString(),
        email         = u["email"]?.ToString(),
        role          = u["role"]?.ToString(),
        avatar        = u["avatar"]?.ToString(),
        bio           = u["bio"]?.ToString(),
        rating        = u["rating"] != null ? Convert.ToDouble(u["rating"]) : 5.0,
        walletBalance = u["wallet_balance"] != null ? Convert.ToDouble(u["wallet_balance"]) : 0.0,
        createdAt     = u["created_at"]?.ToString(),
    }));
});

webApp.MapGet("/api/admin/jobs", (HttpContext context) =>
{
    if (!AdminHelper.IsAdmin(context)) return Results.Forbid();

    var rows = Database.ExecuteQuery(@"
        SELECT j.id, j.title, j.description, j.category, j.address, j.pay,
               j.status, j.payment_status, j.payment_amount, j.work_date, j.created_at,
               e.name as employer_name, w.name as worker_name
        FROM jobs j
        JOIN  users e ON j.employer_id = e.id
        LEFT JOIN users w ON j.worker_id = w.id
        ORDER BY j.created_at DESC");

    return Results.Ok(rows.Select(j => new {
        id             = Convert.ToInt32(j["id"]),
        title          = j["title"]?.ToString(),
        description    = j["description"]?.ToString(),
        category       = j["category"]?.ToString(),
        address        = j["address"]?.ToString(),
        pay            = Convert.ToDouble(j["pay"]),
        status         = j["status"]?.ToString(),
        paymentStatus  = j["payment_status"]?.ToString(),
        paymentAmount  = Convert.ToDouble(j["payment_amount"]),
        workDate       = j["work_date"]?.ToString(),
        createdAt      = j["created_at"]?.ToString(),
        employerName   = j["employer_name"]?.ToString(),
        workerName     = j["worker_name"]?.ToString(),
    }));
});

webApp.MapGet("/api/admin/messages", (HttpContext context) =>
{
    if (!AdminHelper.IsAdmin(context)) return Results.Forbid();

    var rows = Database.ExecuteQuery(@"
        SELECT m.id, m.content, m.message_type, m.created_at,
               u1.name as from_name, u2.name as to_name, j.title as job_title
        FROM messages m
        JOIN  users u1 ON m.from_user_id = u1.id
        JOIN  users u2 ON m.to_user_id   = u2.id
        LEFT JOIN jobs j ON m.job_id = j.id
        ORDER BY m.created_at DESC
        LIMIT 100");

    return Results.Ok(rows.Select(m => new {
        id          = Convert.ToInt32(m["id"]),
        fromName    = m["from_name"]?.ToString(),
        toName      = m["to_name"]?.ToString(),
        jobTitle    = m["job_title"]?.ToString(),
        content     = m["content"]?.ToString(),
        messageType = m["message_type"]?.ToString(),
        createdAt   = m["created_at"]?.ToString(),
    }));
});

webApp.MapDelete("/api/admin/users/{id}", (HttpContext context, int id) =>
{
    if (!AdminHelper.IsAdmin(context)) return Results.Forbid();

    var userRows = Database.ExecuteQuery("SELECT role FROM users WHERE id = @id", new() { { "@id", id } });
    if (userRows.Count == 0) return Results.NotFound(new { message = "Utilizador não encontrado." });
    if (userRows[0]["role"]?.ToString() == "admin") return Results.BadRequest(new { message = "Não é possível eliminar o administrador." });

    try
    {
        // delete jobs by this employer (and their deps)
        var empJobs = Database.ExecuteQuery("SELECT id FROM jobs WHERE employer_id = @id", new() { { "@id", id } });
        foreach (var job in empJobs)
        {
            var jid = Convert.ToInt32(job["id"]);
            Database.ExecuteNonQuery("DELETE FROM messages     WHERE job_id = @j", new() { { "@j", jid } });
            Database.ExecuteNonQuery("DELETE FROM reviews      WHERE job_id = @j", new() { { "@j", jid } });
            Database.ExecuteNonQuery("DELETE FROM applications WHERE job_id = @j", new() { { "@j", jid } });
        }
        Database.ExecuteNonQuery("DELETE FROM jobs         WHERE employer_id = @id", new() { { "@id", id } });
        Database.ExecuteNonQuery("UPDATE jobs SET worker_id = NULL WHERE worker_id = @id", new() { { "@id", id } });
        Database.ExecuteNonQuery("DELETE FROM messages     WHERE from_user_id = @id OR to_user_id = @id", new() { { "@id", id } });
        Database.ExecuteNonQuery("DELETE FROM reviews      WHERE from_user_id = @id OR to_user_id = @id", new() { { "@id", id } });
        Database.ExecuteNonQuery("DELETE FROM applications WHERE worker_id = @id", new() { { "@id", id } });
        Database.ExecuteNonQuery("DELETE FROM availabilities WHERE worker_id = @id", new() { { "@id", id } });
        Database.ExecuteNonQuery("DELETE FROM users        WHERE id = @id", new() { { "@id", id } });
        return Results.Ok(new { message = "Utilizador eliminado com sucesso." });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = $"Erro ao eliminar: {ex.Message}" });
    }
});

webApp.MapDelete("/api/admin/jobs/{id}", (HttpContext context, int id) =>
{
    if (!AdminHelper.IsAdmin(context)) return Results.Forbid();

    try
    {
        Database.ExecuteNonQuery("DELETE FROM messages     WHERE job_id = @id", new() { { "@id", id } });
        Database.ExecuteNonQuery("DELETE FROM reviews      WHERE job_id = @id", new() { { "@id", id } });
        Database.ExecuteNonQuery("DELETE FROM applications WHERE job_id = @id", new() { { "@id", id } });
        Database.ExecuteNonQuery("DELETE FROM jobs         WHERE id     = @id", new() { { "@id", id } });
        return Results.Ok(new { message = "Vaga eliminada com sucesso." });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = $"Erro ao eliminar: {ex.Message}" });
    }
});

webApp.MapPost("/api/admin/jobs/{id}/close", (HttpContext context, int id) =>
{
    if (!AdminHelper.IsAdmin(context)) return Results.Forbid();
    Database.ExecuteNonQuery("UPDATE jobs SET status = 'closed' WHERE id = @id", new() { { "@id", id } });
    return Results.Ok(new { message = "Vaga fechada pelo admin." });
});

// --- Report Chat ---
webApp.MapPost("/api/chat/report", (HttpContext context, ReportChatRequest request) =>
{
    if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
    var userIdStr = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    if (userIdStr == null) return Results.Unauthorized();
    int userId = int.Parse(userIdStr);

    var pars = new Dictionary<string, object>
    {
        { "@reporterId",    userId },
        { "@reportedId",    request.ReportedUserId },
        { "@reason",        request.Reason ?? "" },
        { "@now",           DateTime.UtcNow.ToString("o") },
    };
    string sql;
    if (request.JobId.HasValue)
    {
        pars["@jobId"] = request.JobId.Value;
        sql = @"INSERT INTO reports (reporter_id, reported_user_id, job_id, reason, created_at)
                VALUES (@reporterId, @reportedId, @jobId, @reason, @now)";
    }
    else
    {
        sql = @"INSERT INTO reports (reporter_id, reported_user_id, reason, created_at)
                VALUES (@reporterId, @reportedId, @reason, @now)";
    }
    Database.ExecuteNonQuery(sql, pars);
    return Results.Ok(new { message = "Conversa reportada com sucesso." });
});

// --- Admin: conversation list (grouped) ---
webApp.MapGet("/api/admin/conversations", (HttpContext context) =>
{
    if (!AdminHelper.IsAdmin(context)) return Results.Forbid();

    var rows = Database.ExecuteQuery(@"
        SELECT
            LEAST(m.from_user_id, m.to_user_id)    AS user1_id,
            GREATEST(m.from_user_id, m.to_user_id) AS user2_id,
            m.job_id,
            u1.name  AS user1_name,
            u2.name  AS user2_name,
            j.title  AS job_title,
            MAX(m.created_at)     AS last_message_at,
            COUNT(DISTINCT m.id)  AS message_count,
            COUNT(DISTINCT r.id)  AS report_count
        FROM messages m
        JOIN  users u1 ON u1.id = LEAST(m.from_user_id, m.to_user_id)
        JOIN  users u2 ON u2.id = GREATEST(m.from_user_id, m.to_user_id)
        LEFT JOIN jobs j ON j.id = m.job_id
        LEFT JOIN reports r ON
            (r.reporter_id    = LEAST(m.from_user_id, m.to_user_id) OR
             r.reporter_id    = GREATEST(m.from_user_id, m.to_user_id))
            AND
            (r.reported_user_id = LEAST(m.from_user_id, m.to_user_id) OR
             r.reported_user_id = GREATEST(m.from_user_id, m.to_user_id))
        GROUP BY LEAST(m.from_user_id, m.to_user_id),
                 GREATEST(m.from_user_id, m.to_user_id),
                 m.job_id
        ORDER BY MAX(m.created_at) DESC");

    return Results.Ok(rows.Select(r => new
    {
        user1Id       = Convert.ToInt32(r["user1_id"]),
        user2Id       = Convert.ToInt32(r["user2_id"]),
        jobId         = r["job_id"] != null && r["job_id"] != DBNull.Value ? (int?)Convert.ToInt32(r["job_id"]) : null,
        user1Name     = r["user1_name"]?.ToString(),
        user2Name     = r["user2_name"]?.ToString(),
        jobTitle      = r["job_title"]?.ToString(),
        lastMessageAt = r["last_message_at"]?.ToString(),
        messageCount  = Convert.ToInt32(r["message_count"]),
        reportCount   = Convert.ToInt32(r["report_count"]),
    }));
});

// --- Admin: messages inside a specific conversation ---
webApp.MapGet("/api/admin/conversation-messages", (HttpContext context) =>
{
    if (!AdminHelper.IsAdmin(context)) return Results.Forbid();
    if (!int.TryParse(context.Request.Query["user1Id"], out var u1)) return Results.BadRequest();
    if (!int.TryParse(context.Request.Query["user2Id"], out var u2)) return Results.BadRequest();
    int? jobId = int.TryParse(context.Request.Query["jobId"], out var jId) ? jId : (int?)null;

    var pars = new Dictionary<string, object> { { "@u1", u1 }, { "@u2", u2 } };
    string jobFilter = jobId.HasValue ? "AND m.job_id = @jobId" : "AND m.job_id IS NULL";
    if (jobId.HasValue) pars["@jobId"] = jobId.Value;

    var rows = Database.ExecuteQuery($@"
        SELECT m.id, m.from_user_id, m.content, m.message_type, m.created_at,
               uf.name AS from_name
        FROM messages m
        JOIN users uf ON uf.id = m.from_user_id
        WHERE ((m.from_user_id = @u1 AND m.to_user_id = @u2)
            OR (m.from_user_id = @u2 AND m.to_user_id = @u1))
        {jobFilter}
        ORDER BY m.created_at ASC", pars);

    return Results.Ok(rows.Select(r => new
    {
        id          = Convert.ToInt32(r["id"]),
        fromUserId  = Convert.ToInt32(r["from_user_id"]),
        fromName    = r["from_name"]?.ToString(),
        content     = r["content"]?.ToString(),
        messageType = r["message_type"]?.ToString(),
        createdAt   = r["created_at"]?.ToString(),
    }));
});

// --- Wallet Endpoint ---

webApp.MapGet("/api/wallet", (HttpContext context) =>
{
    if (context.User.Identity?.IsAuthenticated != true) return Results.Unauthorized();
    var userId = Convert.ToInt32(context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
    var role = context.User.FindFirst(ClaimTypes.Role)?.Value;

    var users = Database.ExecuteQuery("SELECT wallet_balance FROM users WHERE id = @id", new() { { "@id", userId } });
    var balance = users.Count > 0 ? Convert.ToDouble(users[0]["wallet_balance"]) : 0.0;

    // Escrow = jobs accepted+escrowed (pending payout for worker, pending confirmation for employer)
    double escrow = 0;
    if (role == "worker")
    {
        var escrowed = Database.ExecuteQuery(
            "SELECT SUM(pay) as total FROM jobs WHERE worker_id = @id AND payment_status = 'escrowed'",
            new() { { "@id", userId } });
        escrow = escrowed.Count > 0 && escrowed[0]["total"] != null && escrowed[0]["total"] != DBNull.Value
            ? Convert.ToDouble(escrowed[0]["total"]) : 0;
    }

    // Transaction history
    string txQuery = role == "worker"
        ? @"SELECT j.title, j.pay, j.payment_status, j.created_at, e.name as partner_name
            FROM jobs j JOIN users e ON j.employer_id = e.id
            WHERE j.worker_id = @id AND j.payment_status IN ('escrowed','released')
            ORDER BY j.created_at DESC LIMIT 20"
        : @"SELECT j.title, j.pay, j.payment_status, j.created_at, w.name as partner_name
            FROM jobs j LEFT JOIN users w ON j.worker_id = w.id
            WHERE j.employer_id = @id AND j.payment_status IN ('escrowed','released')
            ORDER BY j.created_at DESC LIMIT 20";

    var txRows = Database.ExecuteQuery(txQuery, new() { { "@id", userId } });
    var transactions = txRows.Select(t => new
    {
        title = t["title"]?.ToString(),
        amount = Convert.ToDouble(t["pay"]),
        partnerName = t["partner_name"]?.ToString(),
        date = t["created_at"]?.ToString(),
        status = t["payment_status"]?.ToString()
    }).ToList();

    return Results.Ok(new { balance, escrow, transactions });
});

webApp.Run();

// --- Request records ---
public record RegisterRequest(string Name, string Email, string Password, string Role, double Lat, double Lng, string? Bio = null, double HourlyRate = 0);
public record LoginRequest(string Email, string Password);
public record JobPostRequest(string Title, string Description, string Category, double Lat, double Lng, string Address, double Pay, string PayType, string Duration, string Photo, string? WorkDate = null);
public record ApplyRequest(int JobId);
public record RespondRequest(int ApplicationId, bool Accept);
public record AvailabilityRequest(double Lat, double Lng, double Radius, string StartTime, string EndTime, double HourlyRate, bool IsActive);
public record MessageRequest(int ToUserId, int? JobId, string Content);
public record ProfileUpdateRequest(string Name, string Bio, string? Avatar = null);
public record CompleteJobRequest(int JobId, double Rating, string Comment);
public record EscrowRequest(int JobId, double Hours = 1.0, string? WorkDate = null, string? Notes = null);
public record ReleasePaymentRequest(int JobId, double Rating, string Comment);
public record AcceptWorkerRequest(int JobId, int WorkerId, bool Accept);
public record TipRequest(int JobId, double Amount);
public record CloseJobRequest(int JobId);
public record UpdateJobRequest(int JobId, string Title, string Description, double Pay, string Duration, string? WorkDate = null, string? Address = null);
public record WorkerReviewRequest(int JobId, double Rating, string? Comment = null);
public record ReportChatRequest(int ReportedUserId, int? JobId, string? Reason);

// --- Admin Helper ---
public static class AdminHelper
{
    public static bool IsAdmin(HttpContext ctx) =>
        ctx.User.Identity?.IsAuthenticated == true &&
        ctx.User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value == "admin";
}

// --- Geospatial helpers ---
public static class GeoHelper
{
    public static double Distance(double lat1, double lon1, double lat2, double lon2)
    {
        var R = 6371; // Kilometers
        var dLat = ToRadians(lat2 - lat1);
        var dLon = ToRadians(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return R * c;
    }

    private static double ToRadians(double val)
    {
        return (Math.PI / 180) * val;
    }
}

// --- Password Hashing Helper ---
public static class PasswordHasher
{
    public static string Hash(string password)
    {
        using var sha256 = System.Security.Cryptography.SHA256.Create();
        var bytes = System.Text.Encoding.UTF8.GetBytes(password);
        var hash = sha256.ComputeHash(bytes);
        return Convert.ToBase64String(hash);
    }

    public static bool Verify(string password, string hash)
    {
        if (password == null || hash == null) return false;
        return Hash(password) == hash;
    }
}
