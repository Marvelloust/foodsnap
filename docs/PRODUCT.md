# FoodSnap product model

FoodSnap is not an image-classification utility. It is a food intelligence and discovery product whose scanner creates structured entry points into a wider knowledge system.

## Product promise

**See food. Understand more.**

A scan should help answer four increasingly useful questions:

1. **What is visible?**
2. **What can FoodSnap responsibly infer or read?**
3. **What food knowledge connects to the result?**
4. **Where can the user go next?**

## Core loop

Scan → result → component → ingredient → food/recipe → Saved/Library → search/history → new discovery → scan again.

## Repeat-use reasons

FoodSnap is built to be revisited because it retains:

- scan history
- a searchable visual food library
- saved foods, recipes and ingredients
- user-created library tags
- food-discovery activity
- ingredient and recipe pathways
- assistant conversations scoped to a scan
- personal food/cuisine preferences

## Product entities

### Scan
A user's analysis event. It owns media, staged events, detected items, OCR text, ingredients, allergens, matched foods and assistant context.

### Food
A curated food-knowledge entity such as jollof rice, suya, chana masala or ramen.

### Ingredient
An explorable knowledge entity with uses, substitutions, storage and food/cuisine context.

### Recipe
A structured cooking pathway with ingredients, steps, timing, servings, attribution and Cook Mode.

### Cuisine
A context layer used to browse food without reducing cuisine to a single dish.

## Global food representation

The seeded knowledge model includes West African, East African, North African, South Asian, East Asian, Middle Eastern, Mediterranean, Caribbean, Latin American and European cuisines. Nigerian and other African foods are represented as normal first-class product content, not a special novelty category.

## Health and nutrition position

FoodSnap's identity is food understanding and exploration. It does not center calories, weight, dieting or restrictive scoring. Allergen information is presented only with source/provenance and uncertainty.
