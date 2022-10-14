const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Nft Marketplace Unit Tests", function () {
          let NftMarketplace, NftMarketplaceContract, basicNft, basicNftContract
          const PRICE = ethers.utils.parseEther("0.1")
          const TOKEN_ID = 0

          beforeEach(async () => {
              accounts = await ethers.getSigners() // could also do with getNamedAccounts
              deployer = accounts[0]
              user = accounts[1]
              await deployments.fixture(["all"])
              NftMarketplaceContract = await ethers.getContract(
                  "NftMarketplace"
              )
              NftMarketplace = NftMarketplaceContract.connect(deployer)
              basicNftContract = await ethers.getContract("BasicNft")
              basicNft = await basicNftContract.connect(deployer)
              await basicNft.mintNft()
              await basicNft.approve(NftMarketplaceContract.address, TOKEN_ID)
          })

          describe("listItem", function () {
              it("emits an event after listing an item", async function () {
                  expect(
                      await NftMarketplace.listItem(
                          basicNft.address,
                          TOKEN_ID,
                          PRICE
                      )
                  ).to.emit("ItemListed")
              })
              it("exclusively items that haven't been listed", async function () {
                  await NftMarketplace.listItem(
                      basicNft.address,
                      TOKEN_ID,
                      PRICE
                  )
                  const error = `NftMarketplace__AlreadyListed("${basicNft.address}", ${TOKEN_ID})`
                  //   await expect(
                  //       NftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  //   ).to.be.revertedWith("AlreadyListed")
                  await expect(
                      NftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWithCustomError(NftMarketplace, error)
              })
              it("exclusively allows owners to list", async function () {
                  NftMarketplace = NftMarketplaceContract.connect(user)
                  await basicNft.approve(user.address, TOKEN_ID)
                  await expect(
                      NftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWithCustomError(
                      NftMarketplace,
                      "NftMarketplace__NotOwner"
                  )
              })
              it("needs approvals to list item", async function () {
                  await basicNft.approve(ethers.constants.AddressZero, TOKEN_ID)
                  await expect(
                      NftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWithCustomError(
                      NftMarketplace,
                      "NftMarketplace__NotApprovedForMArketPlace"
                  )
              })
              it("Updates listing with seller and price", async function () {
                  await NftMarketplace.listItem(
                      basicNft.address,
                      TOKEN_ID,
                      PRICE
                  )
                  const listing = await NftMarketplace.getListing(
                      basicNft.address,
                      TOKEN_ID
                  )
                  assert(listing.price.toString() == PRICE.toString())
                  assert(listing.seller.toString() == deployer.address)
              })
          })
          describe("cancelListing", function () {
              it("reverts if there is no listing", async function () {
                  const error = `NftMarketplace__NotListed("${basicNft.address}", ${TOKEN_ID})`
                  await expect(
                      NftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWithCustomError(NftMarketplace, error)
              })
              it("reverts if anyone but the owner tries to call", async function () {
                  await NftMarketplace.listItem(
                      basicNft.address,
                      TOKEN_ID,
                      PRICE
                  )
                  NftMarketplace = NftMarketplaceContract.connect(user)
                  await basicNft.approve(user.address, TOKEN_ID)
                  await expect(
                      NftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWithCustomError(
                      NftMarketplace,
                      "NftMarketplace__NotOwner"
                  )
              })
              it("emits event and removes listing", async function () {
                  await NftMarketplace.listItem(
                      basicNft.address,
                      TOKEN_ID,
                      PRICE
                  )
                  expect(
                      await NftMarketplace.cancelListing(
                          basicNft.address,
                          TOKEN_ID
                      )
                  ).to.emit("ItemCanceled")
                  const listing = await NftMarketplace.getListing(
                      basicNft.address,
                      TOKEN_ID
                  )
                  assert(listing.price.toString() == "0")
              })
          })
          describe("buyItem", function () {
              it("reverts if the item isnt listed", async function () {
                  await expect(
                      NftMarketplace.buyItem(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWithCustomError(
                      NftMarketplace,
                      "NftMarketplace__NotListed"
                  )
              })
              it("reverts if the price isnt met", async function () {
                  await NftMarketplace.listItem(
                      basicNft.address,
                      TOKEN_ID,
                      PRICE
                  )
                  await expect(
                      NftMarketplace.buyItem(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWithCustomError(
                      NftMarketplace,
                      "NftMarketplace__PriceNotMet"
                  )
              })
              it("transfers the nft to the buyer and updates internal proceeds record", async function () {
                  await NftMarketplace.listItem(
                      basicNft.address,
                      TOKEN_ID,
                      PRICE
                  )
                  NftMarketplace = NftMarketplaceContract.connect(user)
                  expect(
                      await NftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                          value: PRICE,
                      })
                  ).to.emit("ItemBought")
                  const newOwner = await basicNft.ownerOf(TOKEN_ID)
                  const deployerProceeds = await NftMarketplace.getProceeds(
                      deployer.address
                  )
                  assert(newOwner.toString() == user.address)
                  assert(deployerProceeds.toString() == PRICE.toString())
              })
          })
          describe("updateListing", function () {
              it("must be owner and listed", async function () {
                  await expect(
                      NftMarketplace.updateListing(
                          basicNft.address,
                          TOKEN_ID,
                          PRICE
                      )
                  ).to.be.revertedWithCustomError(
                      NftMarketplace,
                      "NftMarketplace__NotListed"
                  )
                  await NftMarketplace.listItem(
                      basicNft.address,
                      TOKEN_ID,
                      PRICE
                  )
                  NftMarketplace = NftMarketplaceContract.connect(user)
                  await expect(
                      NftMarketplace.updateListing(
                          basicNft.address,
                          TOKEN_ID,
                          PRICE
                      )
                  ).to.be.revertedWithCustomError(
                      NftMarketplace,
                      "NftMarketplace__NotOwner"
                  )
              })
              it("updates the price of the item", async function () {
                  const updatedPrice = ethers.utils.parseEther("0.2")
                  await NftMarketplace.listItem(
                      basicNft.address,
                      TOKEN_ID,
                      PRICE
                  )
                  expect(
                      await NftMarketplace.updateListing(
                          basicNft.address,
                          TOKEN_ID,
                          updatedPrice
                      )
                  ).to.emit("ItemListed")
                  const listing = await NftMarketplace.getListing(
                      basicNft.address,
                      TOKEN_ID
                  )
                  assert(listing.price.toString() == updatedPrice.toString())
              })
          })
          describe("withdrawProceeds", function () {
              it("doesn't allow 0 proceed withdrawls", async function () {
                  await expect(
                      NftMarketplace.WithdrawProceeds()
                  ).to.be.revertedWithCustomError(
                      NftMarketplace,
                      "NftMarketplace__NoProceeds"
                  )
              })
              it("withdraws proceeds", async function () {
                  await NftMarketplace.listItem(
                      basicNft.address,
                      TOKEN_ID,
                      PRICE
                  )
                  NftMarketplace = NftMarketplaceContract.connect(user)
                  await NftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                      value: PRICE,
                  })
                  NftMarketplace = NftMarketplaceContract.connect(deployer)

                  const deployerProceedsBefore =
                      await NftMarketplace.getProceeds(deployer.address)
                  const deployerBalanceBefore = await deployer.getBalance()
                  const txResponse = await NftMarketplace.WithdrawProceeds()
                  const transactionReceipt = await txResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const deployerBalanceAfter = await deployer.getBalance()

                  assert(
                      deployerBalanceAfter.add(gasCost).toString() ==
                          deployerProceedsBefore
                              .add(deployerBalanceBefore)
                              .toString()
                  )
              })
          })
      })
