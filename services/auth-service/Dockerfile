# Base images are pinned by digest: tags are mutable, so the same Dockerfile could
# build a different image. To update, take the new digest from
# `docker buildx imagetools inspect <image>`
# Build stage: compile and publish the service with the full .NET SDK
FROM mcr.microsoft.com/dotnet/sdk:10.0@sha256:de4fe90a98845d75910b9769662465c84de1a934665c431279d1382b2bddc02b AS build
WORKDIR /src

# Restore packages first: this layer stays cached until the .csproj changes
COPY AuthService.csproj .
RUN dotnet restore

COPY . .
RUN dotnet publish -c Release -o /app --no-restore /p:UseAppHost=false

# Runtime stage: only the ASP.NET Core runtime, much smaller than the SDK
FROM mcr.microsoft.com/dotnet/aspnet:10.0@sha256:de0ee358cdd672f7017a003bed21e9ac9ed48a27c922a59b18175b6e82fa7fee AS runtime
WORKDIR /app
COPY --from=build /app .

# The official .NET images listen on port 8080; run as their non-root user
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "AuthService.dll"]
