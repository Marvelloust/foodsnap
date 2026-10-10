# FoodSnap 1.0.0 — Connected Food Platform Expansion

This release extends the existing FoodSnap food-intelligence product without replacing its scanner, knowledge graph, library or community foundations.

## Connected product loop

FoodSnap now supports a complete journey:

Scan → Food knowledge → Recipe → Meal Plan → Shopping List / Pantry → Cook → Cooking Journal → Community Feed → Messages → Discover again.

The new systems share the same users, foods, cuisines, recipes, ingredients, collections, notifications and privacy model. They are not separate mini-applications.

## Recipe Studio

Signed-in users can create, edit, publish, unpublish and delete personal recipes. A recipe supports:

- title, description, cuisine and category
- prep/cook times, servings and difficulty
- structured ingredients and instructions
- tags
- private / followers / public visibility
- draft / published state
- cover photography
- additional recipe media
- image and MP4/WEBM media upload paths
- version history
- recipe forks/variations
- save counts
- ratings and Made It status
- cooking-journal entries

## Community Feed

The FoodSnap Feed is food-first rather than a generic social timeline.

Users can publish food stories and cooked-recipe posts with images or video. Posts can link to FoodSnap foods, recipes, creator recipes, scans or collections. The feed supports:

- For You / Following / Latest
- likes
- comments and one-level replies
- comment likes
- edit/delete own comments
- delete own posts
- follower-aware visibility
- notification events
- live feed refresh through Server-Sent Events

## Messages

One-to-one FoodSnap messaging supports:

- persistent conversations
- unread state
- real-time message events through SSE
- text messages
- sharing FoodSnap objects inside a conversation
- delete-for-self behavior
- message privacy preferences
- block-aware conversation creation
- new-message notifications

## Meal Planner

Users can create multiple meal plans and organize recipes/foods into dated meal slots.

Planner features include:

- Week view
- Calendar-style view
- List view
- Breakfast / Lunch / Dinner / Snack / custom slots
- servings per entry
- notes
- move/edit/remove entries
- duplicate a plan into another week
- reusable template flag
- add public or creator recipes
- create a shopping list from a plan

## Shopping Lists

FoodSnap supports multiple named shopping lists.

A list supports:

- manual grocery items
- quantity and unit
- categories
- notes
- checked / unchecked state
- edit/delete
- generated ingredients from a meal plan
- quantity aggregation where compatible
- pantry-aware `missing only` generation

## Pantry

The Pantry tracks ingredients already available at home.

It supports:

- ingredient name
- quantity and unit
- use-by date
- personal notes
- edit/delete
- recipe matching against pantry content

The `What can I cook?` view ranks FoodSnap recipes by how many required ingredients match the pantry.

## Cooking Journal

Recipes can be marked as cooked with:

- date
- optional finished-dish photograph
- personal notes
- rating
- Would make again state

A journal entry can be shared into the FoodSnap Community Feed while retaining its recipe relationship.

## Creator workspace

FoodSnap includes a creator-focused dashboard based on real activity rather than invented metrics:

- published/personal recipe count
- community post count
- followers
- post likes/comments
- recipe saves

## Cuisine Atlas

The atlas keeps the repaired responsive grid architecture and avoids the former page-level horizontal overflow. Regional/country cuisine cards use responsive CSS grids and food imagery fallbacks, with FoodSnap knowledge relationships remaining available from each cuisine.

## Navigation

Desktop groups the platform into:

- Your FoodSnap
- Cook + Plan
- Community
- Food Knowledge
- Account

Mobile keeps five thumb-friendly primary actions:

- Home
- Explore
- Scan
- Planner
- Inbox

All remaining destinations are available through the complete mobile navigation drawer.

## Realtime layer

Authenticated browsers use Server-Sent Events from `/api/events` for:

- notifications
- incoming messages
- feed activity

The system can later be swapped to a distributed event transport without changing the user-facing information architecture.

## Data model additions

The expansion adds relational domains for:

- `user_recipes`
- `recipe_media`
- `recipe_versions`
- `recipe_ratings`
- `user_recipe_saves`
- `posts`
- `post_media`
- `post_likes`
- `post_comments`
- `post_comment_likes`
- `conversations`
- `conversation_members`
- `messages`
- `meal_plans`
- `meal_plan_entries`
- `shopping_lists`
- `shopping_list_items`
- `pantry_items`
- `cooking_logs`

They coexist with the existing FoodSnap scanning, knowledge, collection, AI, notification and moderation tables.

## Validation

The release integration suite contains 26 passing tests. In addition to the existing intelligence/product-depth tests, expansion tests cover:

1. Recipe Studio publishing, recipe media, version history, ratings and Cooking Journal.
2. Community Feed interaction and FoodSnap object sharing through Messages.
3. Meal Planner → Shopping List → Pantry integration and meal-plan duplication.
4. Application route availability for Community, Studio, Planner, Shopping, Pantry, Journal, Messages and Creator surfaces.
