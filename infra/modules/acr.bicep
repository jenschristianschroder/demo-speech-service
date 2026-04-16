@description('Azure region')
param location string

@description('ACR resource name')
param name string

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: name
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
  }
}

@description('ACR resource ID')
output id string = acr.id

@description('ACR login server')
output loginServer string = acr.properties.loginServer
