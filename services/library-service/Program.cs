using System.Text;
using LibraryService.Data;
using LibraryService.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

// Name of the cookie where auth-service puts the JWT (AuthController.CookieName there)
const string AccessTokenCookie = "access_token";

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Every error response uses the ProblemDetails format (RFC 9457), so the
// frontend handles all errors the same way
builder.Services.AddProblemDetails();

// The connection string comes from configuration: ConnectionStrings__LibraryDb
// is set by docker-compose from the .env file, so no password lives in the code
// (docker-compose starts this service only once SQL Server is healthy)
builder.Services.AddDbContext<LibraryDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("LibraryDb")));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer();

// Configured through the options system so that a bad key is reported by the
// JwtOptions validation at startup
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<JwtOptions>>((bearer, jwt) =>
    {
        // Keeps the claim names of the token ("sub") instead of mapping them to
        // long XML names: without this, FindFirstValue("sub") returns null
        bearer.MapInboundClaims = false;

        bearer.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwt.Value.Issuer,
            ValidAudience = jwt.Value.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Value.Key)),
        };

        // The token travels in a cookie, not in the Authorization header
        bearer.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                context.Token = context.Request.Cookies[AccessTokenCookie];
                return Task.CompletedTask;
            },
        };
    });

// Validated at startup, so a missing or short key stops the service
builder.Services.AddOptions<JwtOptions>()
    .Bind(builder.Configuration.GetSection(JwtOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();

// Used by Docker and the gateway to know whether the service is up;
// the DbContext check reports Unhealthy when the database is unreachable
builder.Services.AddHealthChecks()
    .AddDbContextCheck<LibraryDbContext>();

var app = builder.Build();

// Create the database and apply pending migrations at startup.
// Simple and fine for this project; production apps usually apply
// migrations in a separate deployment step instead
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<LibraryDbContext>();
    db.Database.Migrate();
}

// Without these, unhandled exceptions and unknown routes return an empty body
app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// CSRF protection: a cross-site request can't carry a custom header without a
// CORS permission, and this API grants none. Only the header's presence is
// checked, not its value
app.Use(async (context, next) =>
{
    var method = context.Request.Method;
    var isSafe = HttpMethods.IsGet(method) || HttpMethods.IsHead(method) || HttpMethods.IsOptions(method);

    if (!isSafe && !context.Request.Headers.ContainsKey("X-CSRF-Token"))
    {
        app.Logger.LogWarning(
            "Request blocked: {Method} {Path} has no X-CSRF-Token header", method, context.Request.Path);
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return;
    }

    await next();
});

// Order matters: first find out who the caller is, then decide what they may do
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");

app.Run();
