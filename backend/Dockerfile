FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build-env
WORKDIR /app

# Copy csproj and restore as distinct layers
COPY ["Projeto intermedio.csproj", "./"]
RUN dotnet restore "Projeto intermedio.csproj"

# Copy everything else and build
COPY . ./
RUN dotnet publish "Projeto intermedio.csproj" -c Release -o out

# Build runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build-env /app/out .

# Create a directory for the database volume
RUN mkdir /data

EXPOSE 8080

# Environment variables for ASP.NET Core
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Development

ENTRYPOINT ["dotnet", "Projeto intermedio.dll"]
