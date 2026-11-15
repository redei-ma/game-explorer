using CatalogService.Services;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    });
builder.Services.AddOpenApi();
// Used by Docker and the gateway to know whether the service is up
builder.Services.AddHealthChecks();

// Every error response uses the ProblemDetails format (RFC 9457), so the
// frontend handles all errors the same way.
builder.Services.AddProblemDetails();

builder.Services.AddMemoryCache();

// --- IGDB -------------------------------------------------------------------
// Validated at startup, so missing credentials stop the service instead of
// failing on the first request while /health still says Healthy.
builder.Services.AddOptions<IgdbOptions>()
    .Bind(builder.Configuration.GetSection(IgdbOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();

// 1. An HttpClient that points to Twitch's login server, used only to get tokens.
builder.Services.AddHttpClient(IgdbTokenProvider.HttpClientName, client =>
{
    client.BaseAddress = new Uri("https://id.twitch.tv/");
});

// 2. The token cache. Singleton, so every request shares the same cached token.
builder.Services.AddSingleton<IgdbTokenProvider>();

// 3. The handler that stamps Client-ID + Bearer token onto every IGDB request.
//    Transient, as HttpClient message handlers must be.
builder.Services.AddTransient<IgdbAuthHandler>();

// 4. The IGDB typed client itself, with the auth handler plugged into its pipeline.
builder.Services.AddHttpClient<IgdbClient>(client =>
{
    client.BaseAddress = new Uri("https://api.igdb.com/v4/"); // trailing slash matters here too
})
.AddHttpMessageHandler<IgdbAuthHandler>();

var app = builder.Build();

// Without these, unhandled exceptions and unknown routes return an empty body.
app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");

app.Run();
