using System.Net;

namespace AuthService.IntegrationTests;

/// <summary>
/// Checks /health, which also reports whether the database is reachable.
/// </summary>
public class HealthCheckTests(AuthApiFactory factory) : IClassFixture<AuthApiFactory>
{
    [Fact]
    public async Task Health_ReturnsHealthy_WhenTheDatabaseIsUp()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync());
    }
}
