# Product Introduction

## Context
Picking a film takes too long, and most sites need users to maintain a long watched history. I want to build a light and fast movie recommender to find a movie to watch at any time, without effort, even without sign in. 

## Big Idea
idea -> movie list -> tap -> movie list gets closer to the user’s taste (start from an idea -> tap -> get an interested movie list -> leave)

## The Loop
1. Type any idea in your mind
2. Get the first load of movies (N is not confirmed)
3. Tap a few, then refresh the list
4. The movie list would be closer and closer to your taste
5. Save the interested ones when viewing the recommendations

## Detailed Interaction
A search bar by default, providing a few representative queries to guide users to use it. After a simple query, below the search bar, the application returns a ranked movie list. 

On each recommended movie, the user can select `watched` or `interested`. To the watched movies, the user can tap `liked` or `disliked` as the next step, providing their preference to the recommender. The interested tap can also express their movie preference. 

The `interested` movies will be saved for the user to use later.
The tapped movies are marked as grey in the list, the user can keep scrolling to view and tap more, and there is a `refresh` button for the user to access another movie list (more taps, closer to their taste).

## Experiment
Before building the product, I need to do some experiments to see if the assumption could work. 

1. Which text fields are useful for searching movies?
2. How are the search results for different queries?
3. How does the tap loop work?
4. Can an LLM help with the query?

### How search works
This project will use `TMDB` API to get the movie data, because it’s free, broad, and easy to get started. 
Generate a vector for each movie from their text information: `genres`, `tagline`, `overview`, `keywords`, `reviews`, `credits`, and calculate the similarity score between the query vector and the movie vector. 

