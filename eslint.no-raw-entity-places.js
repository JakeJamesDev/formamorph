import ts from 'typescript'

/**
 * Where an entity is comes from the Entity Places module (ADR-0017). Type-aware: it fires only on the `locations`
 * that the `Entity` interface declares, through any `Pick` of it, so a world's location list never trips it.
 */
const ENTITY_TYPES = /[\\/]src[\\/]types[\\/]world\.ts$/

const declaredByEntity = (symbol) =>
  (symbol?.declarations ?? []).some((d) =>
    ts.isPropertySignature(d)
    && ts.isInterfaceDeclaration(d.parent)
    && d.parent.name.text === 'Entity'
    && ENTITY_TYPES.test(d.getSourceFile().fileName))

export const noRawEntityPlacesRule = {
  meta: {
    type: 'problem',
    docs: { description: "Forbid touching an entity's stored locations outside the Entity Places module." },
    schema: [],
    messages: {
      rawPlaces: "Ask the Entity Places module where an entity is; never read or write its `locations`.",
    },
  },
  create(context) {
    const services = context.sourceCode.parserServices
    if (!services?.program) throw new Error('formamorph/no-raw-entity-places needs type information (parserOptions.projectService).')
    const checker = services.program.getTypeChecker()
    const isEntityField = (node) => declaredByEntity(checker.getSymbolAtLocation(services.esTreeNodeToTSNodeMap.get(node)))
    const isLocations = (key) => key && (key.type === 'Identifier' ? key.name : key.value) === 'locations'
    const report = (node) => context.report({ node, messageId: 'rawPlaces' })
    return {
      MemberExpression(node) {
        const key = node.computed ? node.property.type === 'Literal' && node.property : node.property
        if (isLocations(key) && isEntityField(key)) report(node)
      },
      'ObjectPattern > Property'(node) {
        if (node.computed || !isLocations(node.key)) return
        const pattern = checker.getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(node.parent))
        if (declaredByEntity(checker.getNonNullableType(pattern).getProperty('locations'))) report(node)
      },
      'ObjectExpression > Property'(node) {
        if (node.computed || !isLocations(node.key)) return
        const literal = services.esTreeNodeToTSNodeMap.get(node.parent)
        const contextual = checker.getContextualType(literal)
        if (contextual && declaredByEntity(contextual.getProperty('locations'))) report(node)
      },
    }
  },
}
