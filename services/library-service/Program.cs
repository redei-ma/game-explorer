using LibraryService.Data;
using LibraryService.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// The connection string comes from configuration: ConnectionStrings__LibraryDb
// is set by docker-compose from the .env file, so no password lives in the code
// (docker-compose starts this service only once SQL Server is healthy)
builder.Services.AddDbContext<LibraryDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("LibraryDb")));

// Typed HTTP client for catalog-service. The base address comes from configuration
// (Services__Catalog__BaseUrl in docker-compose), never hardcoded.
builder.Services.AddHttpClient<CatalogClient>(client =>
{
    var baseUrl = builder.Configuration["Services:Catalog:BaseUrl"]
        ?? throw new InvalidOperationException("Services:Catalog:BaseUrl is not configured.");
    client.BaseAddress = new Uri(baseUrl);
    client.Timeout = TimeSpan.FromSeconds(5); // fail fast instead of hanging if catalog is stuck
});

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

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");

app.Run();
