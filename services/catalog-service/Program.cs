using CatalogService.Services;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    });
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
// Used by Docker and the gateway to know whether the service is up
builder.Services.AddHealthChecks();

builder.Services.AddMemoryCache();

// Registers RawgClient so ASP.NET can inject it into controllers
// and configures the HttpClient it receives.
builder.Services.AddHttpClient<RawgClient>(client =>
{
    client.BaseAddress = new Uri("https://api.rawg.io/api/"); // trailing slash matters
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");

app.Run();
