using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.SqlClient;
using Testcontainers.MsSql;

namespace LibraryService.IntegrationTests;

// Starts a real SQL Server in a container for the tests, then the service on top of it
public class LibraryApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    // Same image as docker-compose.yml: keep the two in sync
    private readonly MsSqlContainer _database =
        new MsSqlBuilder("mcr.microsoft.com/mssql/server:2022-CU27-GDR1-ubuntu-22.04@sha256:cf8f0ab2ebe61feec2eed2629061a07d247f791c2a8ddda74a4ac9f06a291718").Build();

    public Task InitializeAsync() => _database.StartAsync();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // The container's connection string points to master: use the service's own database
        var connectionString = new SqlConnectionStringBuilder(_database.GetConnectionString())
        {
            InitialCatalog = "LibraryDb",
        }.ConnectionString;
        builder.UseSetting("ConnectionStrings:LibraryDb", connectionString);
        builder.UseSetting("Jwt:Key", "integration-tests-signing-key-not-a-secret");
    }

    public new Task DisposeAsync() => _database.DisposeAsync().AsTask();
}
