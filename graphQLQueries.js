const getUnResolvedCommentsQuery = `
query($organization: String!, $repo: String!, $prId: Int!) {
   repository(owner: $organization, name: $repo) {
      pullRequest(number: $prId) {
         reviewThreads(first: 100) {
            nodes {
               isResolved
               comments(first: 100) {
                  nodes {
                     body
                     state
                     author {
                        login
                     }
                  }
               }
            }
         }
      }
   }
}
`;

module.exports = getUnResolvedCommentsQuery;
