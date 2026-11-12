using System.Net;
using System.Net.Http.Json;
using AuthService.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;

namespace AuthService.IntegrationTests;


/// <summary>
/// Register, login, recovery, deletion, logout and /me, over HTTP against a real database.
/// </summary>
public class AuthEndpointsTests(AuthApiFactory factory) : IClassFixture<AuthApiFactory>
{
    private const string Password = "Secret123!";

    // The cookie is Secure, so the test client only sends it back over https.
    private HttpClient CreateClientWithoutCsrfHeader() => factory.CreateClient(
        new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });

    private HttpClient CreateClient()
    {
        var client = CreateClientWithoutCsrfHeader();
        client.DefaultRequestHeaders.Add("X-CSRF-Token", "1");
        return client;
    }

    // The database is shared by the tests in this class, so each one uses its own user.
    private static RegisterRequest NewUser()
    {
        var id = Guid.NewGuid().ToString("N");
        // 20 characters: usernames are at most 30, also with the "other" prefix used below.
        return new RegisterRequest($"{id}@test.com", id[..20], Password);
    }

    [Fact]
    public async Task Register_CreatesTheUserAndSetsTheCookie()
    {
        var user = NewUser();

        var response = await CreateClient().PostAsJsonAsync("/api/auth/register", user);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var cookie = Assert.Single(response.Headers.GetValues("Set-Cookie"));
        Assert.StartsWith("access_token=", cookie);
        Assert.Contains("httponly", cookie);
        Assert.Contains("secure", cookie);
        Assert.Contains("samesite=strict", cookie);
        Assert.Contains("path=/api", cookie);

        var body = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.Equal(user.Email, body!.User.Email);
        Assert.Equal(user.Username, body.User.Username);
    }

    [Fact]
    public async Task Register_ReturnsARecoveryCode()
    {
        var response = await CreateClient().PostAsJsonAsync("/api/auth/register", NewUser());

        var body = await response.Content.ReadFromJsonAsync<RegisterResponse>();
        Assert.Equal(32, body!.RecoveryCode.Length);
    }

    [Fact]
    public async Task Register_Returns409_WhenTheEmailIsTaken()
    {
        var client = CreateClient();
        var user = NewUser();
        await client.PostAsJsonAsync("/api/auth/register", user);

        var response = await client.PostAsJsonAsync(
            "/api/auth/register", user with { Username = "other" + user.Username });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Register_Returns409_WhenTheUsernameIsTaken()
    {
        var client = CreateClient();
        var user = NewUser();
        await client.PostAsJsonAsync("/api/auth/register", user);

        var response = await client.PostAsJsonAsync(
            "/api/auth/register", user with { Email = "other" + user.Email });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Register_Returns400WithTheFailedRules_WhenThePasswordIsWeak()
    {
        var response = await CreateClient().PostAsJsonAsync(
            "/api/auth/register", NewUser() with { Password = "secret" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.Contains("PasswordRequiresDigit", problem!.Errors.Keys);
    }

    [Theory]
    [InlineData(2)]
    [InlineData(31)]
    public async Task Register_Returns400_WhenTheUsernameIsNot3To30Characters(int length)
    {
        var response = await CreateClient().PostAsJsonAsync(
            "/api/auth/register", NewUser() with { Username = new string('a', length) });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.Contains("Username", problem!.Errors.Keys);
    }

    [Theory]
    [InlineData(" spaces@test.com")]
    [InlineData("spaces@test.com ")]
    public async Task Register_Returns400_WhenTheEmailHasSpaces(string email)
    {
        var response = await CreateClient().PostAsJsonAsync(
            "/api/auth/register", NewUser() with { Email = email });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.Contains("Email", problem!.Errors.Keys);
    }

    [Fact]
    public async Task Login_ReturnsTheUser_WhenThePasswordIsRight()
    {
        var client = CreateClient();
        var user = NewUser();
        await client.PostAsJsonAsync("/api/auth/register", user);

        var response = await client.PostAsJsonAsync(
            "/api/auth/login", new LoginRequest(user.Email, user.Password));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.Equal(user.Email, body!.User.Email);
    }

    [Fact]
    public async Task Login_SetsTheCookie()
    {
        var user = NewUser();
        await CreateClient().PostAsJsonAsync("/api/auth/register", user);

        var response = await CreateClient().PostAsJsonAsync(
            "/api/auth/login", new LoginRequest(user.Email, user.Password));

        var cookie = Assert.Single(response.Headers.GetValues("Set-Cookie"));
        Assert.StartsWith("access_token=", cookie);
    }

    [Fact]
    public async Task Login_GivesTheSameAnswer_ForWrongPasswordAndUnknownEmail()
    {
        var client = CreateClient();
        var user = NewUser();
        await client.PostAsJsonAsync("/api/auth/register", user);

        var wrongPassword = await client.PostAsJsonAsync(
            "/api/auth/login", new LoginRequest(user.Email, "Wrong123!"));
        var unknownEmail = await client.PostAsJsonAsync(
            "/api/auth/login", new LoginRequest("nobody@test.com", "Wrong123!"));

        Assert.Equal(HttpStatusCode.Unauthorized, wrongPassword.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unknownEmail.StatusCode);
        var first = await wrongPassword.Content.ReadFromJsonAsync<ProblemDetails>();
        var second = await unknownEmail.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal("Invalid email or password.", first!.Detail);
        Assert.Equal(first.Detail, second!.Detail);
    }

    [Fact]
    public async Task Login_LocksTheAccount_AfterFiveFailedAttempts()
    {
        var client = CreateClient();
        var user = NewUser();
        await client.PostAsJsonAsync("/api/auth/register", user);

        for (var attempt = 0; attempt < 5; attempt++)
        {
            await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(user.Email, "Wrong123!"));
        }
        var response = await client.PostAsJsonAsync(
            "/api/auth/login", new LoginRequest(user.Email, user.Password));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Post_Returns403_WithoutTheCsrfHeader()
    {
        var response = await CreateClientWithoutCsrfHeader().PostAsJsonAsync(
            "/api/auth/register", NewUser());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Logout_Returns403_WithoutTheCsrfHeader()
    {
        var response = await CreateClientWithoutCsrfHeader().PostAsync("/api/auth/logout", null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private async Task<(RegisterRequest User, string Code)> RegisterWithCode(HttpClient client)
    {
        var user = NewUser();
        var response = await client.PostAsJsonAsync("/api/auth/register", user);
        var body = await response.Content.ReadFromJsonAsync<RegisterResponse>();
        return (user, body!.RecoveryCode);
    }

    [Fact]
    public async Task Recover_SetsTheNewPassword_AndReplacesTheCode()
    {
        var client = CreateClient();
        var (user, code) = await RegisterWithCode(client);

        var response = await client.PostAsJsonAsync(
            "/api/auth/recover", new RecoverRequest(user.Email, code, "NewSecret123!"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<RecoverResponse>();
        Assert.NotEqual(code, body!.RecoveryCode);
        var newLogin = await client.PostAsJsonAsync(
            "/api/auth/login", new LoginRequest(user.Email, "NewSecret123!"));
        Assert.Equal(HttpStatusCode.OK, newLogin.StatusCode);
        var oldLogin = await client.PostAsJsonAsync(
            "/api/auth/login", new LoginRequest(user.Email, user.Password));
        Assert.Equal(HttpStatusCode.Unauthorized, oldLogin.StatusCode);
    }

    [Fact]
    public async Task Recover_RejectsACodeAlreadyUsed()
    {
        var client = CreateClient();
        var (user, code) = await RegisterWithCode(client);
        await client.PostAsJsonAsync(
            "/api/auth/recover", new RecoverRequest(user.Email, code, "NewSecret123!"));

        var response = await client.PostAsJsonAsync(
            "/api/auth/recover", new RecoverRequest(user.Email, code, "Another123!"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Recover_GivesTheSameAnswer_ForWrongCodeAndUnknownEmail()
    {
        var client = CreateClient();
        var (user, _) = await RegisterWithCode(client);

        var wrongCode = await client.PostAsJsonAsync(
            "/api/auth/recover", new RecoverRequest(user.Email, "wrong", "NewSecret123!"));
        var unknownEmail = await client.PostAsJsonAsync(
            "/api/auth/recover", new RecoverRequest("nobody@test.com", "wrong", "NewSecret123!"));

        Assert.Equal(HttpStatusCode.Unauthorized, wrongCode.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unknownEmail.StatusCode);
        var first = await wrongCode.Content.ReadFromJsonAsync<ProblemDetails>();
        var second = await unknownEmail.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal(first!.Detail, second!.Detail);
    }

    [Fact]
    public async Task Recover_LocksTheAccount_AfterFiveWrongCodes()
    {
        var client = CreateClient();
        var (user, code) = await RegisterWithCode(client);

        for (var attempt = 0; attempt < 5; attempt++)
        {
            await client.PostAsJsonAsync(
                "/api/auth/recover", new RecoverRequest(user.Email, "wrong", "NewSecret123!"));
        }
        var response = await client.PostAsJsonAsync(
            "/api/auth/recover", new RecoverRequest(user.Email, code, "NewSecret123!"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Recover_KeepsTheCode_WhenTheNewPasswordIsWeak()
    {
        var client = CreateClient();
        var (user, code) = await RegisterWithCode(client);

        var weak = await client.PostAsJsonAsync(
            "/api/auth/recover", new RecoverRequest(user.Email, code, "secret"));
        var retry = await client.PostAsJsonAsync(
            "/api/auth/recover", new RecoverRequest(user.Email, code, "NewSecret123!"));

        Assert.Equal(HttpStatusCode.BadRequest, weak.StatusCode);
        Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
    }

    private HttpRequestMessage DeleteAccountRequestWith(string password) =>
        new(HttpMethod.Delete, "/api/auth/me") { Content = JsonContent.Create(new DeleteAccountRequest(password)) };

    [Fact]
    public async Task DeleteAccount_RemovesTheAccount()
    {
        var client = CreateClient();
        var (user, code) = await RegisterWithCode(client);

        var response = await client.SendAsync(DeleteAccountRequestWith(user.Password));

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var login = await client.PostAsJsonAsync(
            "/api/auth/login", new LoginRequest(user.Email, user.Password));
        var recover = await client.PostAsJsonAsync(
            "/api/auth/recover", new RecoverRequest(user.Email, code, "NewSecret123!"));
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, recover.StatusCode);
    }

    [Fact]
    public async Task DeleteAccount_Returns403AndKeepsTheAccount_WhenThePasswordIsWrong()
    {
        var client = CreateClient();
        var (user, _) = await RegisterWithCode(client);

        var response = await client.SendAsync(DeleteAccountRequestWith("Wrong123!"));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var login = await client.PostAsJsonAsync(
            "/api/auth/login", new LoginRequest(user.Email, user.Password));
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
    }

    [Fact]
    public async Task DeleteAccount_Returns429AndKeepsTheAccount_WhenTheAccountIsLocked()
    {
        var client = CreateClient();
        var (user, _) = await RegisterWithCode(client);
        for (var i = 0; i < 5; i++)
        {
            await client.SendAsync(DeleteAccountRequestWith("Wrong123!"));
        }

        var response = await client.SendAsync(DeleteAccountRequestWith(user.Password));

        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        // Registering the same email again fails only if the account is still there.
        var again = await client.PostAsJsonAsync("/api/auth/register", user);
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
    }

    [Fact]
    public async Task DeleteAccount_Returns401_WithoutTheCookie()
    {
        var response = await CreateClient().SendAsync(DeleteAccountRequestWith(Password));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Me_Returns401_WithoutTheCookie()
    {
        var response = await CreateClient().GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Me_ReturnsTheUser_AfterRegistering()
    {
        var client = CreateClient();
        var user = NewUser();
        var registered = await client.PostAsJsonAsync("/api/auth/register", user);
        var expected = await registered.Content.ReadFromJsonAsync<AuthResponse>();

        var response = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(expected!.User, await response.Content.ReadFromJsonAsync<UserResponse>());
    }

    [Fact]
    public async Task Logout_DeletesTheCookie()
    {
        var client = CreateClient();
        await client.PostAsJsonAsync("/api/auth/register", NewUser());

        var logout = await client.PostAsync("/api/auth/logout", null);
        var me = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, me.StatusCode);
    }
}
