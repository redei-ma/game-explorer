using System.Net;

namespace CatalogService.IntegrationTests;

public class HealthCheckTests(CatalogApiFactory factory)
    : IClassFixture<CatalogApiFactory>
{
    [Fact]
    public async Task Health_ReturnsHealthy()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync());
    }
}
