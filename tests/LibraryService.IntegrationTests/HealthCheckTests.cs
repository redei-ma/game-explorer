using System.Net;

namespace LibraryService.IntegrationTests;

public class HealthCheckTests(LibraryApiFactory factory) : IClassFixture<LibraryApiFactory>
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
