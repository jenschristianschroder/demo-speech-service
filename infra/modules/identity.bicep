@description('Azure region')
param location string

@description('Managed Identity name')
param name string

@description('Resource ID of the Azure Speech resource')
param speechResourceId string

@description('ACR resource ID')
param acrId string

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: name
  location: location
}

// Cognitive Services User role — allows using Speech API with managed identity
resource speechRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(speechResourceId, identity.id, 'CognitiveServicesUser')
  scope: speechResource
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'a97b65f3-24c7-4388-baec-2e87135dc908')
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// AcrPull role — allows pulling images from ACR
resource acrRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acrId, identity.id, 'AcrPull')
  scope: acrResource
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource speechResource 'Microsoft.CognitiveServices/accounts@2024-10-01' existing = {
  name: last(split(speechResourceId, '/'))
}

resource acrResource 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: last(split(acrId, '/'))
}

@description('Identity resource ID')
output id string = identity.id

@description('Identity client ID')
output clientId string = identity.properties.clientId

@description('Speech resource endpoint (custom subdomain URL)')
output speechEndpoint string = speechResource.properties.endpoint
