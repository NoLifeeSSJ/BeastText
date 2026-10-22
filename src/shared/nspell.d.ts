declare module "nspell" {
  interface Speller {
    correct(word: string): boolean;
    suggest(word: string): string[];
    add(word: string): Speller;
  }
  export default function nspell(dictionary: {
    aff: string;
    dic: string;
  }): Speller;
}
