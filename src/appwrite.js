import { Client, Databases, Query, ID } from "appwrite";

const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID;
const COLLECTION_ID = import.meta.env.VITE_APPWRITE_COLLECTION_ID;
const PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID;

const client = new Client()
  .setEndpoint("https://fra.cloud.appwrite.io/v1")
  .setProject(PROJECT_ID);

const database = new Databases(client);

export const updateSearchCount = async (searchTerm, movie) => {
  try {
    const result = await database.listDocuments(DATABASE_ID, COLLECTION_ID, [
      Query.equal("movie_id", [movie.id]),
    ]);

    if (result.documents.length > 0) {
      const document = result.documents[0];
      const newCount = (document.count || 0) + 1;
      await database.updateDocument(DATABASE_ID, COLLECTION_ID, document.$id, {
        count: newCount,
      });
    } else {
      await database.createDocument(DATABASE_ID, COLLECTION_ID, ID.unique(), {
        searchTerm,
        count: 1,
        movie_id: movie.id,
        poster_url: `https://image.tmdb.org/t/p/w500${movie.poster_path}`,
      });
    }
  } catch (error) {
    console.error("Error updating search count:", error);
  }
};

export const getTrendingMovies = async () => {
  try {
    const result = await database.listDocuments(DATABASE_ID, COLLECTION_ID, [
      Query.limit(10),
      Query.orderDesc("count"),
    ]);
    const seenMovieIds = new Set();
    return result.documents
      .filter((document) => {
        if (seenMovieIds.has(document.movie_id)) return false;
        seenMovieIds.add(document.movie_id);
        return true;
      })
      .slice(0, 5);
  } catch (error) {
    console.error("Error fetching trending movies:", error);
    return [];
  }
};