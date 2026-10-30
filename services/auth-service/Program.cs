using System.Text;
using AuthService.Controllers;
using AuthService.Data;
using AuthService.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi.
builder.Services.AddOpenApi();

// Every error response uses the ProblemDetails format (RFC 9457), so the
// frontend handles all errors the same way.
builder.Services.AddProblemDetails();

// The connection string comes from configuration, so no password lives in the
// code: user secrets with dotnet run, ConnectionStrings__AuthDb in Docker.
builder.Services.AddDbContext<AuthDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("AuthDb")));

// Identity without cookies or UI: user management (UserManager) and the
// password check with lockout (SignInManager), since this API signs users in
// with JWTs. Users log in by email, so it must be unique.
builder.Services.AddIdentityCore<IdentityUser>(options =>
    {
        options.User.RequireUniqueEmail = true;
    })
    .AddEntityFrameworkStores<AuthDbContext>()
    .AddSignInManager();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer();

// Configured through the options system so that a bad key is reported by the
// JwtOptions validation at startup.
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<JwtOptions>>((bearer, jwt) =>
    {
        // Keeps the claim names of the token ("sub", "email") instead of
        // mapping them to long XML names.
        bearer.MapInboundClaims = false;

        bearer.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwt.Value.Issuer,
            ValidAudience = jwt.Value.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Value.Key)),
        };

        // The token travels in a cookie, not in the Authorization header.
        bearer.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                context.Token = context.Request.Cookies[AuthController.CookieName];
                return Task.CompletedTask;
            },
        };
    });

// Validated at startup, so a missing or short key stops the service instead
// of failing at the first login.
builder.Services.AddOptions<JwtOptions>()
    .Bind(builder.Configuration.GetSection(JwtOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddScoped<TokenService>();

// Used by Docker and the gateway to know whether the service is up. The
// DbContext check reports Unhealthy when the database is unreachable.
builder.Services.AddHealthChecks()
    .AddDbContextCheck<AuthDbContext>();

var app = builder.Build();

// Creates AuthDb on first run and applies any pending migrations.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AuthDbContext>();
    db.Database.Migrate();
}

// Without these, unhandled exceptions and unknown routes return an empty body.
app.UseExceptionHandler();
app.UseStatusCodePages();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// CSRF protection: a browser can't add a custom header to a cross-site request
// without a CORS permission, which this API never grants, so the header's
// presence proves the request came from our own app. The value doesn't matter.
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

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");

app.Run();
