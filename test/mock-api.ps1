param(
  [ValidateRange(1024, 65535)]
  [int]$Port = 8787
)

$ErrorActionPreference = "Stop"
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$rootPrefix = $projectRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
$dataPath = Join-Path $PSScriptRoot "mock-data.json"
$mockData = Get-Content -LiteralPath $dataPath -Raw -Encoding UTF8 | ConvertFrom-Json
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$script:quoteRequests = New-Object System.Collections.Generic.List[object]
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Write-JsonResponse {
  param(
    [System.Net.HttpListenerResponse]$Response,
    [int]$StatusCode,
    [object]$Payload
  )

  $Response.StatusCode = $StatusCode
  $Response.ContentType = "application/json; charset=utf-8"
  $bytes = $utf8.GetBytes(($Payload | ConvertTo-Json -Depth 12))
  $Response.ContentLength64 = $bytes.Length
  $Response.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Write-TextResponse {
  param(
    [System.Net.HttpListenerResponse]$Response,
    [int]$StatusCode,
    [string]$ContentType,
    [string]$Content
  )

  $Response.StatusCode = $StatusCode
  $Response.ContentType = $ContentType
  $bytes = $utf8.GetBytes($Content)
  $Response.ContentLength64 = $bytes.Length
  $Response.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Get-MockImageUrl {
  param(
    [string]$ImagePath,
    [System.Net.HttpListenerRequest]$Request
  )

  if ($ImagePath -match "^https?://") {
    return $ImagePath
  }

  return $Request.Url.GetLeftPart([System.UriPartial]::Authority) + $ImagePath
}

function Get-StaticFile {
  param([string]$RequestPath)

  if ($RequestPath -eq "/") {
    $RequestPath = "/frontend/pages/index.html"
  }

  if ($RequestPath -match "(^|/)login\.html$") {
    return [pscustomobject]@{
      Path = (Join-Path $PSScriptRoot "mock-login.html")
      Virtual = $true
    }
  }

  $relativePath = [System.Uri]::UnescapeDataString($RequestPath.TrimStart("/"))
  $filePath = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $relativePath))
  if (-not $filePath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $null
  }
  if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
    return $null
  }
  return [pscustomobject]@{
    Path = $filePath
    Virtual = $false
  }
}

function Get-ContentType {
  param([string]$Path)

  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".html" { return "text/html; charset=utf-8" }
    ".css" { return "text/css; charset=utf-8" }
    ".js" { return "text/javascript; charset=utf-8" }
    ".json" { return "application/json; charset=utf-8" }
    ".jpg" { return "image/jpeg" }
    ".jpeg" { return "image/jpeg" }
    ".png" { return "image/png" }
    ".svg" { return "image/svg+xml" }
    ".webp" { return "image/webp" }
    default { return "application/octet-stream" }
  }
}

function Get-RequestBody {
  param([System.Net.HttpListenerRequest]$Request)

  $reader = New-Object System.IO.StreamReader($Request.InputStream, $Request.ContentEncoding)
  try {
    return $reader.ReadToEnd()
  }
  finally {
    $reader.Dispose()
  }
}

function Get-ApiResponse {
  param([System.Net.HttpListenerContext]$Context)

  $request = $Context.Request
  $response = $Context.Response
  $path = $request.Url.AbsolutePath
  $origin = $request.Url.GetLeftPart([System.UriPartial]::Authority)

  if ($request.HttpMethod -eq "GET") {
    switch ($path) {
      "/api/v1/site-settings" {
        $settings = [ordered]@{
          hero_slogan = $mockData.site_settings.hero_slogan
          hero_image_url = Get-MockImageUrl $mockData.site_settings.hero_image_path $request
        }
        Write-JsonResponse $response 200 @{ success = $true; data = @{ settings = $settings } }
        return $true
      }
      "/api/v1/site-content" {
        $page = $request.QueryString["page"]
        if ($page -notin @("home", "services", "warehouses", "contact", "login", "register")) {
          Write-JsonResponse $response 400 @{ success = $false; error = @{ code = "INVALID_PAGE"; message = "Page key is not supported." } }
          return $true
        }
        $content = $mockData.site_content.pages.$page
        if ($page -eq "home" -and $content.hero_image_url -match "^/") {
          $content = $content | Select-Object *
          $content.hero_image_url = Get-MockImageUrl $content.hero_image_url $request
        }
        Write-JsonResponse $response 200 @{ success = $true; data = @{ page = $page; content = $content } }
        return $true
      }
      "/api/v1/service-slides" {
        $audience = $request.QueryString["audience"]
        if ($audience -notin @("customer", "business")) {
          Write-JsonResponse $response 400 @{ success = $false; error = @{ code = "INVALID_AUDIENCE"; message = "Audience must be customer or business." } }
          return $true
        }
        $slides = @($mockData.service_slides.$audience | ForEach-Object {
          @{
            title = $_.title
            alt = $_.alt
            image_url = Get-MockImageUrl $_.image_path $request
          }
        })
        Write-JsonResponse $response 200 @{ success = $true; data = @{ slides = $slides } }
        return $true
      }
      "/api/v1/articles" {
        Write-JsonResponse $response 200 @{ success = $true; data = @{ articles = @($mockData.articles) } }
        return $true
      }
      "/api/v1/customers" {
        Write-JsonResponse $response 200 @{ success = $true; data = @{ customers = @($mockData.customers) } }
        return $true
      }
      "/api/v1/auth/me" {
        if ($request.Cookies["tlyun-mock-auth"]) {
          Write-JsonResponse $response 200 @{ success = $true; data = @{ id = "mock-user-001"; name = "Tài khoản thử nghiệm"; role = "customer" } }
        }
        else {
          Write-JsonResponse $response 401 @{ success = $false; error = @{ code = "UNAUTHENTICATED"; message = "Vui lòng đăng nhập." } }
        }
        return $true
      }
      "/api/v1/mock-logout" {
        $cookie = New-Object System.Net.Cookie("tlyun-mock-auth", "", "/", "localhost")
        $cookie.Expires = [DateTime]::UtcNow.AddDays(-1)
        $response.Cookies.Add($cookie)
        Write-JsonResponse $response 200 @{ success = $true; data = @{ logged_out = $true } }
        return $true
      }
      "/api/v1/mock/quotes" {
        Write-JsonResponse $response 200 @{ success = $true; data = @{ requests = @($script:quoteRequests) } }
        return $true
      }
    }
  }

  if ($request.HttpMethod -eq "POST") {
    if ($path -eq "/api/v1/mock-login") {
      $form = [System.Web.HttpUtility]::ParseQueryString((Get-RequestBody $request))
      $returnTo = $form["returnTo"]
      if ([string]::IsNullOrWhiteSpace($returnTo) -or $returnTo.StartsWith("//") -or $returnTo -match "^[a-zA-Z][a-zA-Z0-9+.-]*:") {
        $returnTo = "/frontend/pages/services.html"
      }
      $cookie = New-Object System.Net.Cookie("tlyun-mock-auth", "1", "/", "localhost")
      $cookie.HttpOnly = $true
      $response.Cookies.Add($cookie)
      $response.StatusCode = 303
      if (-not $returnTo.StartsWith("/")) {
        $loginPath = $request.Url.AbsolutePath
        $returnTo = $loginPath.Substring(0, $loginPath.LastIndexOf("/") + 1) + $returnTo
      }
      $response.RedirectLocation = $origin + $returnTo
      return $true
    }

    if ($path -in @("/api/v1/transport-quotes", "/api/v1/packing-quotes")) {
      if (-not $request.Cookies["tlyun-mock-auth"]) {
        Write-JsonResponse $response 401 @{ success = $false; error = @{ code = "UNAUTHENTICATED"; message = "Vui lòng đăng nhập." } }
        return $true
      }

      try {
        $body = Get-RequestBody $request | ConvertFrom-Json
      }
      catch {
        Write-JsonResponse $response 400 @{ success = $false; error = @{ code = "INVALID_JSON"; message = "Dữ liệu gửi lên không hợp lệ." } }
        return $true
      }

      $script:quoteRequests.Add([pscustomobject]@{
        id = "MOCK-$('{0:D4}' -f ($script:quoteRequests.Count + 1))"
        type = if ($path -eq "/api/v1/transport-quotes") { "transport" } else { "packing" }
        created_at = [DateTime]::UtcNow.ToString("o")
        payload = $body
      })
      $saved = $script:quoteRequests[$script:quoteRequests.Count - 1]
      Write-Host ("[MOCK] Nhận {0} quote: {1}" -f $saved.type, $saved.id) -ForegroundColor Green
      Write-JsonResponse $response 201 @{ success = $true; data = @{ id = $saved.id; status = "received"; message = "Mock quote received. No real data was saved." } }
      return $true
    }
  }

  return $false
}

$listener.Start()
Write-Host "TLyuN mock server is running at http://localhost:$Port/" -ForegroundColor Cyan
Write-Host "Open http://localhost:$Port/frontend/pages/services.html to test the service forms."
Write-Host "Mock quote submissions are in memory; inspect them at http://localhost:$Port/api/v1/mock/quotes"
Write-Host "Press Ctrl+C to stop the server."

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    try {
      $handled = Get-ApiResponse $context
      if (-not $handled) {
        $staticFile = Get-StaticFile $context.Request.Url.AbsolutePath
        if ($staticFile) {
          $contentType = Get-ContentType $staticFile.Path
          $content = [System.IO.File]::ReadAllBytes($staticFile.Path)
          $context.Response.StatusCode = 200
          $context.Response.ContentType = $contentType
          $context.Response.ContentLength64 = $content.Length
          $context.Response.OutputStream.Write($content, 0, $content.Length)
        }
        else {
          Write-JsonResponse $context.Response 404 @{ success = $false; error = @{ code = "NOT_FOUND"; message = "Không tìm thấy tài nguyên." } }
        }
      }
    }
    catch {
      Write-Host ("[MOCK] Request error: {0}" -f $_.Exception.Message) -ForegroundColor Red
      try {
        Write-JsonResponse $context.Response 500 @{ success = $false; error = @{ code = "MOCK_SERVER_ERROR"; message = "Mock server request failed." } }
      }
      catch {
        $context.Response.Abort()
      }
    }
    finally {
      $context.Response.Close()
    }
  }
}
finally {
  $listener.Stop()
  $listener.Close()
}
