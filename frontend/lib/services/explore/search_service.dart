import 'package:shared_preferences/shared_preferences.dart';

class SearchService {
  static const String _recentSearchesKey = 'recent_searches';
  static const int _maxRecentSearches = 5;

  Future<List<String>> getRecentSearches() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getStringList(_recentSearchesKey) ?? [];
  }

  Future<void> saveSearchTerm(String term) async {
    final prefs = await SharedPreferences.getInstance();
    List<String> searches = await getRecentSearches();

    // Remove if already exists
    searches.remove(term);

    // Add to beginning
    searches.insert(0, term);

    // Keep only the most recent searches
    if (searches.length > _maxRecentSearches) {
      searches = searches.take(_maxRecentSearches).toList();
    }

    await prefs.setStringList(_recentSearchesKey, searches);
  }

  Future<void> removeSearchTerm(String term) async {
    final prefs = await SharedPreferences.getInstance();
    List<String> searches = await getRecentSearches();
    searches.remove(term);
    await prefs.setStringList(_recentSearchesKey, searches);
  }

  Future<void> clearRecentSearches() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_recentSearchesKey);
  }
}
