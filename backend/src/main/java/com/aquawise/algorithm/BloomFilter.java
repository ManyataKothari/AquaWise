package com.aquawise.algorithm;
import java.nio.charset.StandardCharsets;import java.util.*;
/** Bloom membership precheck. Positive results are NOT exact membership. */
public class BloomFilter {
 private final BitSet bits;private final int size,hashes;
 public BloomFilter(int size,int hashes){if(size<8||hashes<1)throw new IllegalArgumentException("Invalid Bloom parameters");this.size=size;this.hashes=hashes;bits=new BitSet(size);}
 private int index(String s,int seed){byte[] bytes=s.getBytes(StandardCharsets.UTF_8);long h=2166136261L+seed*0x9e3779b9L;for(byte b:bytes){h^=b&255;h=(h*16777619L)&0xffffffffL;}return (int)(h%size);}
 public void add(String s){Objects.requireNonNull(s);for(int i=0;i<hashes;i++)bits.set(index(s,i));}
 public boolean mightContain(String s){Objects.requireNonNull(s);for(int i=0;i<hashes;i++)if(!bits.get(index(s,i)))return false;return true;}
}
