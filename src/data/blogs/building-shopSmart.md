# Building shopSmart: A Conversational Shopping Agent with GenAI & LangGraph

*By Jane Waithira • April 2025*

---

## 🎯 The Problem --

Online shopping across multiple marketplaces can be tedious:

- You want a particular brand, size, color, and price range.  
- You have to jump between Amazon, eBay, and more to compare listings.  
- Manually reading ratings, reviews, delivery estimates… it all adds up to decision fatigue.

**Goal:** Let a generative AI–powered agent understand your natural‑language request and do the heavy lifting: search, filter, compare, and recommend—automatically.

---

## 🤖 How GenAI Helps

Generative AI (e.g. Google's Gemini) excels at:

1. **Natural‑language understanding:** Parse "Show me Nike running shoes under $150, size 9, in black."  
2. **Decision logic:** We can have it choose the best product by price, rating, or delivery time.  
3. **Function calling:** Seamlessly invoke Python tools to run searches or fetch details.  

By combining an LLM with a small toolkit of Python "@tool" functions, we get an **agent** that talks to you like a human assistant but executes code under the hood.

---

## 🏗️ Architecture Overview

1. **Tool Functions**  
   We define simple Python functions for:  
   - `search_shoes(query, preferences) → JSON`  
   - `compare_products(product_ids) → JSON`  
   - `get_product_details(product_id) → JSON`  
   - `update_preferences(prefs) → JSON`  

   Each is decorated with `@tool` so the LLM can call it directly:

   ```python
   @tool
   def search_shoes(query: str, preferences: Optional[Dict[str,Any]] = None) -> str:
       """
       Filters mock Amazon/eBay catalogs for matching shoes.
       Returns JSON summary of matches.
       """
       # ... filter logic, fallback if no exact matches ...
       return json.dumps(results)
   ```

2. **Conversation Graph (LangGraph)**  
   We orchestrate the flow via a `StateGraph`:

   ```python
   from langgraph.graph import StateGraph, START, END
   from langgraph.prebuilt import ToolNode

   # Create nodes
   workflow = StateGraph(ShoppingState)
   workflow.add_node("chatbot", chatbot_node)
   workflow.add_node("tools", ToolNode([search_shoes, compare_products, …]))
   workflow.add_node("ordering", ordering_node)

   # Add edges
   workflow.add_edge(START, "chatbot")
   workflow.add_edge("chatbot", "tools", condition=…)
   workflow.add_edge("tools", "chatbot")
   workflow.add_edge("chatbot", "ordering", condition=…)
   workflow.add_edge("ordering", "chatbot")
   ```

3. **LLM Binding**  
   We bind Gemini via `langchain_google_genai`:

   ```python
   from langchain_google_genai import ChatGoogleGenerativeAI
   llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash-latest")
   llm_with_tools = llm.bind_tools([search_shoes, compare_products, get_product_details, update_preferences])
   ```

   Inside our `chatbot_node`, prompts combine system instructions with conversation history, and we call:

   ```python
   response = llm_with_tools.invoke([
       {"role": "system", "content": system_prompt},
       *state["messages"]
   ])
   ```

---

## ⚙️ Example Interaction

```
You: Show me Adidas sneakers under $120 in size 9.
Agent: Searching for Adidas shoes under $120 in size 9…
Agent: I found 3 matches on Amazon and 2 on eBay. Here's the top pick:   
   • **Amazon – Adidas Ultraboost 21** ($110, 4.7★, 3‑day delivery)  
Would you like details or compare options?
```

Behind the scenes, the model called `search_shoes`, parsed the JSON, and generated that summary.

---

## ⚠️ Limitations

1. **Mock Data**  
   Right now we use static Python lists. Real‑world APIs will require authentication, rate limits, pagination, and error handling.

2. **LLM Dependence & Cost**  
   Each user turn incurs API calls. High chat volume can become expensive and suffer latency.

3. **Edge Cases**  
   - Ambiguous requests ("I want something comfy") need more sophisticated preference elicitation.  
   - Numeric conversions (EU vs. US sizes) are approximate.

---

## 🚀 Future & Art‑of‑the‑Possible

- **Real‑Time Market Data**  
  Integrate Amazon's and eBay's official APIs, plus other retailers.

- **Vector Search & RAG**  
  Use embeddings to index a large product catalog and retrieve relevant items via semantic similarity.

- **Multi‑Modal Inputs**  
  Let users upload images of shoes they like, then use Vision + LLM to find similar products.

- **Persistent Profiles**  
  Store preferences and past orders in a database; use context caching for personalized recommendations over time.

- **Front‑End UI**  
  Build a Streamlit or React app so users can chat with shopSmart in their browser or mobile.

---

## 🎉 Conclusion

We've shown how to combine a modern LLM (Gemini) with a small Python toolkit and LangGraph orchestration to build a multi‑step shopping agent. This pattern generalizes to many domains—anywhere you need conversational retrieval, filtering, and structured outputs.
