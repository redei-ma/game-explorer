using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.SqlClient;
using Testcontainers.MsSql;

namespace LibraryService.IntegrationTests;

// Starts a real SQL Server in a container for the tests, then the service on top of it
public class LibraryApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly MsSqlContainer _database =
        new MsSqlBuilder("mcr.microsoft.com/mssql/server:2022-latest").Build();

    public Task InitializeAsync() => _database.StartAsync();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // The container's connection string points to master: use the service's own database
        var connectionString = new SqlConnectionStringBuilder(_database.GetConnectionString())
        {
            InitialCatalog = "LibraryDb",
        }.ConnectionString;
        builder.UseSetting("ConnectionStrings:LibraryDb", connectionString);
    }

    public new Task DisposeAsync() => _database.DisposeAsync().AsTask();
}
