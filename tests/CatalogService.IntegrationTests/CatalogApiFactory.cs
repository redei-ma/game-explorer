using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace CatalogService.IntegrationTests;

// Starts the service with fake IGDB credentials: the startup validation needs them,
// and CI has no user secrets. The tests never call Twitch or IGDB
public class CatalogApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("Igdb:ClientId", "integration-tests-client-id");
        builder.UseSetting("Igdb:ClientSecret", "integration-tests-client-secret");
    }
}
