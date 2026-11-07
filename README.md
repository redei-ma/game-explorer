# Gaming Explorer

Web application to explore the world of video games through the
[IGDB](https://api-docs.igdb.com/) REST API: search, filters, detail pages, favorites
and wishlist.

> The project brief asks for the RAWG API. RAWG became unusable during development, so
> the catalog data now comes from IGDB (owned by Twitch). See
> [Data source: IGDB instead of RAWG](#data-source-igdb-instead-of-rawg) for what changed.

> 🚧 Work in progress — school project, delivery on 15 November 2026.

## Features

Core:

- **Home page** with a search bar and a selection of games
- **Search** by full or partial game name
- **Advanced search** by genre, platform, release year and rating, with sorting
  (name, release date, rating)
- **Game list** as a grid of cards: cover, title, release date, rating, main platforms
- **Game detail page**: description, screenshots, genres, platforms, developer,
  publisher, rating and critic score (IGDB's aggregated critic rating, in place of
  Metacritic)
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

Open https://localhost:8443 (http://localhost:8080 redirects there). The certificate is
self-signed, generated when the gateway image is built, so the browser shows a warning:
accept it once to continue. A build without cache (`--no-cache`) generates a new
certificate, and the warning comes back. Stop with `docker compose down` (the database is
kept; add `-v` to delete it).

### Develop

Run in Docker what you are not changing, and locally what you are working on:

- **Development override:** copy it once with
  `cp docker-compose.override.example.yml docker-compose.override.yml`. Compose loads it
  on its own with every command: it publishes the services on ports 5001–5003 and SQL
  Server on 1433, and runs the services in `Development`. Without it only the gateway is
  reachable, as in the delivered setup; with it, `docker compose -f docker-compose.yml up -d`
  still runs the delivered setup.
- **Frontend:** with the stack running, `cd frontend && npm ci && npm start`, then open
  http://localhost:4200. API calls are proxied to the services (`frontend/proxy.conf.json`).
- **A backend service:** stop its container (e.g. `docker compose stop catalog-service`),
  then `cd services/catalog-service && dotnet watch`. It listens on the same port.
  Outside Docker each service reads its secrets from user secrets, loaded in the
  `Development` environment set by `Properties/launchSettings.json`. Copy them from
  `.env` once per machine, and again after changing it, from the repository root:

  ```bash
  SA_PASSWORD="$(grep '^MSSQL_SA_PASSWORD=' .env | cut -d= -f2-)"
  dotnet user-secrets set "Igdb:ClientId" "$(grep '^IGDB_CLIENT_ID=' .env | cut -d= -f2-)" --project services/catalog-service
  dotnet user-secrets set "Igdb:ClientSecret" "$(grep '^IGDB_CLIENT_SECRET=' .env | cut -d= -f2-)" --project services/catalog-service
  dotnet user-secrets set "ConnectionStrings:AuthDb" "Server=localhost,1433;Database=AuthDb;User Id=sa;Password=$SA_PASSWORD;TrustServerCertificate=True" --project services/auth-service
  dotnet user-secrets set "Jwt:Key" "$(grep '^JWT_KEY=' .env | cut -d= -f2-)" --project services/auth-service
  dotnet user-secrets set "ConnectionStrings:LibraryDb" "Server=localhost,1433;Database=LibraryDb;User Id=sa;Password=$SA_PASSWORD;TrustServerCertificate=True" --project services/library-service
  ```

- **Calling auth-service directly (curl, Postman):** POST requests need an `X-CSRF-Token`
  header, with any value. Without it the service answers `403`.
- **Database migrations:** creating one needs the EF Core tool
  (`dotnet tool install --global dotnet-ef`); see `services/auth-service/Data/Migrations`.
  Services apply pending migrations at startup.

| Address                | What                                          |
| ---------------------- | --------------------------------------------- |
| https://localhost:8443 | the app, through the nginx gateway            |
| http://localhost:8080  | redirects to https://localhost:8443           |
| http://localhost:4200  | Angular dev server (`npm start`)              |
| http://localhost:5001  | catalog-service (direct access, e.g. Postman) |
| http://localhost:5002  | auth-service (direct access)                  |
| http://localhost:5003  | library-service (direct access)               |
| localhost:1433         | SQL Server                                    |

Ports 5001–5003 and 1433 are published only with the development override.

### Tests

```bash
dotnet test GameExplorer.slnx              # every test project in the solution
cd frontend && npm test -- --watch=false   # every *.spec.ts under frontend/src
./scripts/smoke-test.sh                    # after docker compose up -d: the stack through the gateway
```

`dotnet test` needs Docker running: the auth-service and library-service tests
start their own SQL Server in a container ([Testcontainers](https://dotnet.testcontainers.org/)).
Every Pull Request into `dev` or `main` runs the same builds and tests in the CI
(`.github/workflows/ci.yml`), then builds the Docker images and runs the smoke test
on the stack as delivered. Run the smoke test at most once a minute: the login rate
limit remembers the attempts.

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
frontend/                             Angular app
gateway/                              nginx: serves the app and forwards calls to the services
services/catalog-service/             games data from IGDB
services/auth-service/                registration, login and JWT
services/library-service/             favorites and wishlist
tests/                                backend test projects, one per service and test type
scripts/                              smoke test of the running stack
docker-compose.yml                    the whole stack, as delivered
docker-compose.override.example.yml   ports and Development for local work
```

## Data source: IGDB instead of RAWG

### Credentials

IGDB has no simple API key. It uses a **Twitch application**:

1. Log in at [dev.twitch.tv/console](https://dev.twitch.tv/console) (two-factor
   authentication must be enabled on the Twitch account).
2. **Register Your Application**: any name, OAuth Redirect URL `http://localhost`,
   category *Application Integration*, client type *Confidential*.
3. Copy the **Client ID**, generate a **Client Secret**, and put both in `.env` as
   `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET`.

catalog-service exchanges them for an access token at `https://id.twitch.tv/oauth2/token`
(OAuth *client credentials* flow), keeps the token in memory, and renews it shortly
before it expires or as soon as IGDB answers `401`. The secret never leaves the backend:
IGDB does not allow calls from the browser anyway.

### How catalog-service talks to IGDB

| File                           | Role                                                                 |
| ------------------------------ | -------------------------------------------------------------------- |
| `Services/IgdbTokenProvider.cs` | gets and caches the Twitch access token                             |
| `Services/IgdbAuthHandler.cs`  | adds `Client-ID` and `Authorization: Bearer` to every IGDB request   |
| `Services/IgdbClient.cs`       | builds the queries and converts the answers into `Models/`           |
| `Services/IgdbModels.cs`       | the shape of IGDB's raw JSON                                         |
| `Services/PlatformCatalog.cs`  | rebuilds RAWG's "parent platforms" (PC, PlayStation, Xbox...)        |

Every IGDB call is a `POST` whose body is a query in IGDB's language,
[Apicalypse](https://api-docs.igdb.com/#apicalypse-1), for example
`fields name, cover.image_id; where genres = (12); sort rating desc; limit 20;`.

**The public API of catalog-service did not change**: same URLs, same parameters, same
JSON. Only the ids are different (they are now IGDB ids), and the frontend reads them
from `/api/genres`, `/api/platforms` and `/api/parent-platforms`, so it needed no changes.

### Differences from RAWG, and how they are handled

| Topic             | RAWG                          | IGDB                                   | What we do                                                                                    |
| ----------------- | ----------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------- |
| Metacritic score  | `metacritic`                  | not available                          | `metacritic` holds `aggregated_rating`, the average of critic reviews (0-100, rounded)        |
| User rating       | 0-5                           | `rating`, 0-100                        | divided by 20, so it stays on the 0-5 scale                                                   |
| Release date      | `"yyyy-MM-dd"`                | Unix timestamp                         | converted to `"yyyy-MM-dd"`                                                                   |
| Images            | full URL                      | `image_id` only                        | URL built from `images.igdb.com`; cards use the cover, the detail page uses an artwork        |
| Developer / publisher | two lists                 | one `involved_companies` list with flags | split by the `developer` and `publisher` flags                                              |
| Parent platforms  | built in                      | "platform families": no PC, Mac or iOS; Android filed under Linux | families + hand-made groups for PC, Mac, iOS and Android (ids 1006, 1014, 1039, 1034), which take priority over IGDB's family |
| Total results     | `count` in the same answer    | separate `/games/count` call           | both calls are sent at the same time                                                          |
| Search + sorting  | combinable                    | `search` cannot be sorted              | name search uses `name ~ *"word"*` for each word, which can be sorted                         |
| DLCs, bundles     | mostly hidden                 | returned as separate games             | only main games, standalone expansions, remakes, remasters and expanded games are kept        |
| Rate limit        | none relevant                 | 4 requests per second                  | genres and platforms cached for 24 h; a `429` is retried once after one second                |

Sorting by rating ignores games with fewer than 10 user ratings, so a single 100/100
vote does not put an unknown game first. Allowed `ordering` values: `name`, `released`,
`rating`, `metacritic`, `added` (popularity), `created`, `updated`, with `-` in front
for descending. Invalid parameters now get a `400` with an explanation.

## Contributing

- `main` is stable; `dev` is the integration branch.
- Work on a branch created from `dev` and open a Pull Request into `dev`: it
  needs one approval and the CI checks to pass.
- Commits in [Conventional Commits](https://www.conventionalcommits.org/)
  format: `feat(catalog): add genre filter`.

## Team

Marianna Cecchelli · Leonardo Marino · Renato Dei Marini
