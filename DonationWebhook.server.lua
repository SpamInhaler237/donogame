local HttpService = game:GetService("HttpService")
local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")

local GamepassDamageMap = require(script.Parent:WaitForChild("GamepassDamageMap"))

-- Replace this with your public WispByte app URL plus /api/donations.
local WEBHOOK_URL = "https://your-wispbyte-domain.example/api/donations"
local WEBHOOK_SECRET = "7bd4fcb64d3ce8f351b715a86629961d5f6d34052ff3f7cc5185692102fca76f"

local function postDonation(player, amount, productId, productName, productType)
  local payload = {
    userId = player.UserId,
    username = player.Name,
    displayName = player.DisplayName,
    amount = amount,
    productId = productId,
    productName = productName,
    productType = productType,
    source = "roblox-server"
  }

  local ok, response = pcall(function()
    return HttpService:RequestAsync({
      Url = WEBHOOK_URL,
      Method = "POST",
      Headers = {
        ["Content-Type"] = "application/json",
        ["x-donation-secret"] = WEBHOOK_SECRET
      },
      Body = HttpService:JSONEncode(payload)
    })
  end)

  if not ok then
    warn("Donation webhook failed:", response)
    return
  end

  if not response.Success then
    warn("Donation webhook returned:", response.StatusCode, response.Body)
  end
end

MarketplaceService.PromptGamePassPurchaseFinished:Connect(function(player, gamePassId, wasPurchased)
  if not wasPurchased then
    return
  end

  local amount = GamepassDamageMap[gamePassId]

  if not amount then
    warn("Missing gamepass amount for", gamePassId)
    return
  end

  postDonation(player, amount, gamePassId, tostring(amount), "gamepass")
end)

local DeveloperProductAmounts = {
  -- [1234567890] = 100,
}

MarketplaceService.ProcessReceipt = function(receiptInfo)
  local player = Players:GetPlayerByUserId(receiptInfo.PlayerId)

  if player then
    local amount = DeveloperProductAmounts[receiptInfo.ProductId]

    if amount then
      postDonation(player, amount, receiptInfo.ProductId, tostring(amount), "developer-product")
    end
  end

  return Enum.ProductPurchaseDecision.PurchaseGranted
end
