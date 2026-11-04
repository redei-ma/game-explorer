# Gaming Explorer

Web application to explore the world of video games through the
[RAWG](https://rawg.io/apidocs) REST API: search, filters, detail pages, favorites
and wishlist.

> 🚧 Work in progress — school project, delivery on 15 November 2026.

## Features

Core:

- **Home page** with a search bar and a selection of games
- **Search** by full or partial game name
- **Advanced search** by genre, platform, release year and rating, with sorting
  (name, release date, rating)
- **Game list** as a grid of cards: cover, title, release date, rating, main platforms
- **Game detail page**: description, screenshots, genres, platforms, developer,
  publisher, rating and Metacritic score
- **Favorites**: add and remove games, view them in a dedicated page. Guests'
  favorites are kept in the browser; after login they are stored in the user's account
- Clear **loading, error and empty-result** states
- **Responsive** layout for desktop, tablet and smartphone

Planned extras:

- **User accounts**: register and log in (JWT). Everything stays usable without an
  account; logging in keeps favorites and wishlist in the database, across devices
- **Wishlist**: games to buy or try, separate from favorites
- **Dark / light mode**, remembered across visits

## Stack

- **Backend:** ASP.NET Core (.NET 10) microservices, Entity Framework Core
- **Frontend:** Angular + Bootstrap
- **Database:** SQL Server Express
- **Infrastructure:** Docker Compose, nginx as gateway

## Getting started

You need **Docker** (with Compose). To work on the code outside Docker you also need
the **.NET SDK 10** and **Node.js 24**.

### Run everything

```bash
cp .env.example .env          # then fill in every value (see the comments)
docker compose up -d --build
```

Open http://localhost:8080 in Chrome or Firefox. Safari doesn't send `Secure` cookies to
`http://localhost` ([WebKit bug 281149](https://webkit.org/b/281149)), so login doesn't
last there. Stop with `docker compose down` (the database is kept; add `-v` to delete it).

### Develop

Run in Docker what you are not changing, and locally what you are working on:

- **Frontend:** with the stack running, `cd frontend && npm ci && npm start`, then open
  http://localhost:4200. API calls are proxied to the services (`frontend/proxy.conf.json`).
- **A backend service:** stop its container (e.g. `docker compose stop catalog-service`),
  then `cd services/catalog-service && dotnet watch`. It listens on the same port.
  Outside Docker each service reads its secrets from user secrets, loaded in the
  `Development` environment set by `Properties/launchSettings.json`. Copy them from
  `.env` once per machine, and again after changing it, from the repository root:

  ```bash
  SA_PASSWORD="$(grep '^MSSQL_SA_PASSWORD=' .env | cut -d= -f2-)"
  dotnet user-secrets set "Rawg:ApiKey" "$(grep '^RAWG_API_KEY=' .env | cut -d= -f2-)" --project services/catalog-service
  dotnet user-secrets set "ConnectionStrings:AuthDb" "Server=localhost,1433;Database=AuthDb;User Id=sa;Password=$SA_PASSWORD;TrustServerCertificate=True" --project services/auth-service
  dotnet user-secrets set "Jwt:Key" "$(grep '^JWT_KEY=' .env | cut -d= -f2-)" --project services/auth-service
  dotnet user-secrets set "ConnectionStrings:LibraryDb" "Server=localhost,1433;Database=LibraryDb;User Id=sa;Password=$SA_PASSWORD;TrustServerCertificate=True" --project services/library-service
  ```

- **Calling auth-service directly (curl, Postman):** POST requests need an `X-CSRF-Token`
  header, with any value. Without it the service answers `403`.
- **Database migrations:** creating one needs the EF Core tool
  (`dotnet tool install --global dotnet-ef`); see `services/auth-service/Data/Migrations`.
  Services apply pending migrations at startup.

| Address | What |
| ------- | ---- |
| http://localhost:8080 | the app, through the nginx gateway |
| http://localhost:4200 | Angular dev server (`npm start`) |
| http://localhost:5001 | catalog-service (direct access, e.g. Postman) |
| http://localhost:5002 | auth-service (direct access) |
| http://localhost:5003 | library-service (direct access) |
| localhost:1433 | SQL Server |

### Tests

```bash
dotnet test GameExplorer.slnx              # every test project in the solution
cd frontend && npm test -- --watch=false   # every *.spec.ts under frontend/src
```

`dotnet test` needs Docker running: the auth-service and library-service tests
start their own SQL Server in a container ([Testcontainers](https://dotnet.testcontainers.org/)).
Every Pull Request into `dev` or `main` runs the same builds and tests in the CI
(`.github/workflows/ci.yml`).

Backend tests use xUnit. A new test project goes in `tests/` and runs only once
it is added to the solution:

```bash
dotnet new xunit -o tests/CatalogService.UnitTests
dotnet add tests/CatalogService.UnitTests reference services/catalog-service/CatalogService.csproj
dotnet sln GameExplorer.slnx add tests/CatalogService.UnitTests
```

Then delete `UnitTest1.cs`, an empty test that always passes, and the unused
`coverlet.collector` package from the `.csproj`. Once the project exists, a new
test is just a new class with `[Fact]` methods in it.

Integration tests start the service in memory with `WebApplicationFactory`
(package `Microsoft.AspNetCore.Mvc.Testing`): see
`tests/CatalogService.IntegrationTests`, and `tests/LibraryService.IntegrationTests`
for a service with a database.

### Project structure

```
frontend/                 Angular app
gateway/                  nginx: serves the app and forwards calls to the services
services/catalog-service/ games data from RAWG
services/auth-service/    registration, login and JWT
services/library-service/ favorites and wishlist
tests/                    backend test projects, one per service and test type
docker-compose.yml        the whole stack
```

## Contributing

- `main` is stable; `dev` is the integration branch.
- Work on a branch created from `dev` and open a Pull Request into `dev`: it
  needs one approval and the CI checks to pass.
- Commits in [Conventional Commits](https://www.conventionalcommits.org/)
  format: `feat(catalog): add genre filter`.

## Team

Marianna Cecchelli · Leonardo Marino · Renato Dei Marini
