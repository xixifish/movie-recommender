# Product Document
## Introduction
Picking a film takes long, and most sites also need users to maintain a long watched history. I want to build a light and fast movie recommender for users to find a movie to watch at anytime effortlessly, even without sign in. 
## Big Idea
idea -> movie list -> tap -> movie list updates to  close to the user’s taste
(start from an idea -> tap -> get an intereted movie list -> leave)
## The Loop
1. Type any idea in your mind
2. Get the first load of movies (N is not confirmed)
3. Tap a few, then refresh the list
4. The movie list would be more and more close to your taste
5. Save the interested ones when viewing the recommendations
## Detailed Interaction
A search bar in default, providing a few representative queries to guide users to use it. After a simple query, below the search bar, the application returns a ranked movie list. 
On each recommended movie, the user could select `watched` or `interested`. To the watched movies, the user can tap `liked` or `disliked` for next step, providing their preference to the recommender. Besides, the interested selection could also express their movie preference. 
The `interested` movies will be saved for the user to use later.
The operated movies are marked as grey in the list, the user can keep scrolling to view and operate more, and there is a `refresh` button for the user to access another movie list (more operations, more close to their taste).
## Experiment
Before building the product, I need to do some experiements to see if the assumption could work or not. 
### How search works
This project will use `TMDB` API to get the movie data, because it’s free, large-scope, and easy to get started. 
Generate a vector for each movie on their text information: `genres`, `tagline`, `overview`, `keywords`, `reviews`, `credits`, and calculate the similarity score between the query vector and the movie vector. 
Before building the product, it’s necessay to do some experiments to see how the text information of movies works for the searching. 

