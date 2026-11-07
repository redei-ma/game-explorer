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

// --- IGDB -------------------------------------------------------------------
// 1. An HttpClient that points to Twitch's login server, used only to get tokens.
builder.Services.AddHttpClient(IgdbTokenProvider.HttpClientName, client =>
{
    client.BaseAddress = new Uri("https://id.twitch.tv/");
});

// 2. The token cache. Singleton = one shared instance, so the token is shared by all requests.
builder.Services.AddSingleton<IgdbTokenProvider>();

// 3. The handler that stamps Client-ID + Bearer token onto every IGDB request.
//    Transient = a new one each time the HttpClient pipeline is built (required for handlers).
builder.Services.AddTransient<IgdbAuthHandler>();

// 4. The IGDB typed client itself, with the auth handler plugged into its pipeline.
builder.Services.AddHttpClient<IgdbClient>(client =>
{
    client.BaseAddress = new Uri("https://api.igdb.com/v4/"); // trailing slash matters here too
})
.AddHttpMessageHandler<IgdbAuthHandler>();

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
