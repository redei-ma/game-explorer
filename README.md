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

## Contributing

- `main` is stable; `dev` is the integration branch.
- Work on a branch created from `dev` (`feat/...`, `fix/...`, `docs/...`, `chore/...`)
  and open a Pull Request into `dev`. At least one approval is required.
- Commits in English, [Conventional Commits](https://www.conventionalcommits.org/)
  format: `feat(catalog): add genre filter`.
- Everything in the repository (code, comments, docs) is written in English.

## Team

Marianna Cecchelli · Leonardo Marino · Renato Dei Marini
